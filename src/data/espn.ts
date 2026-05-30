import axios from 'axios';
import { env } from '../env.js';
import { TeamStats, InjuryReport, SeriesState } from '../types.js';
import { espnLimiter } from './limiters.js';

const espn = axios.create({ baseURL: env.espnNbaUrl });

// ─── Injury Reports ───────────────────────────────────────────────────────────

export async function fetchInjuryReports(): Promise<InjuryReport[]> {
  try {
    await espnLimiter.throttle();
    const res = await espn.get('/injuries');
    espnLimiter.recordSuccess();
    const injuries: InjuryReport[] = [];

    for (const team of res.data?.injuries ?? []) {
      for (const player of team.injuries ?? []) {
        injuries.push({
          playerId: player.athlete?.id ?? '',
          playerName: player.athlete?.displayName ?? '',
          teamId: team.team?.id ?? '',
          teamName: team.team?.displayName ?? '',
          status: normalizeStatus(player.status ?? ''),
          description: player.details?.fantasyStatus?.description ?? player.type ?? '',
          reportedAt: Date.now(),
        });
      }
    }

    return injuries;
  } catch {
    espnLimiter.recordFailure();
    return [];
  }
}

function normalizeStatus(s: string): InjuryReport['status'] {
  const upper = s.toUpperCase();
  if (upper.includes('OUT')) return 'OUT';
  if (upper.includes('DOUBTFUL')) return 'DOUBTFUL';
  if (upper.includes('QUESTIONABLE')) return 'QUESTIONABLE';
  if (upper.includes('PROBABLE')) return 'PROBABLE';
  return 'ACTIVE';
}

// ─── Team Stats ───────────────────────────────────────────────────────────────

export async function fetchTeamStats(teamId: string): Promise<TeamStats | null> {
  try {
    await espnLimiter.throttle();
    const res = await espn.get(`/teams/${teamId}`);
    espnLimiter.recordSuccess();
    const team = res.data?.team;
    if (!team) return null;

    const record = team.record?.items?.[0]?.stats ?? [];
    const getstat = (name: string) =>
      record.find((s: { name: string; value: number }) => s.name === name)?.value ?? 0;

    return {
      teamId,
      teamName: team.displayName,
      wins: getstat('wins'),
      losses: getstat('losses'),
      last10: { wins: getstat('last10Wins'), losses: getstat('last10Losses') },
      homeRecord: { wins: getstat('homeWins'), losses: getstat('homeLosses') },
      awayRecord: { wins: getstat('roadWins'), losses: getstat('roadLosses') },
    };
  } catch {
    espnLimiter.recordFailure();
    return null;
  }
}

// ─── Playoff Series ───────────────────────────────────────────────────────────

export async function fetchPlayoffSeries(): Promise<SeriesState[]> {
  try {
    await espnLimiter.throttle();
    const res = await espn.get('/scoreboard', {
      params: { seasontype: 3 }, // postseason
    });
    espnLimiter.recordSuccess();

    const series: SeriesState[] = [];

    const events = res.data?.events ?? [];
    const entries: Array<{ event: typeof events[0]; comp: { series?: { competitors?: Array<{ id: string; wins: number }> } }; home: { team: { id: string; displayName: string }; linescores?: unknown[] }; away: { team: { id: string; displayName: string }; linescores?: unknown[] } }> = [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');
      if (!home || !away) continue;

      entries.push({ event, comp, home, away });
    }

    // Fetch all team stats in parallel
    const teamStatsResults = await Promise.all(
      entries.flatMap(e => [fetchTeamStats(e.home.team.id), fetchTeamStats(e.away.team.id)])
    );

    for (let i = 0; i < entries.length; i++) {
      const { event, comp, home, away } = entries[i]!;
      const homeStats = teamStatsResults[i * 2];
      const awayStats = teamStatsResults[i * 2 + 1];

      // Use comp.series.competitors for actual playoff series wins (not season records)
      const seriesCompetitors = comp.series?.competitors ?? [];
      const homeSeriesEntry = seriesCompetitors.find((c: { id: string; wins: number }) => c.id === home.team.id);
      const awaySeriesEntry = seriesCompetitors.find((c: { id: string; wins: number }) => c.id === away.team.id);

      series.push({
        seriesId: event.id,
        homeTeam: homeStats ?? {
          teamId: home.team.id,
          teamName: home.team.displayName,
          wins: 0, losses: 0,
          last10: { wins: 0, losses: 0 },
          homeRecord: { wins: 0, losses: 0 },
          awayRecord: { wins: 0, losses: 0 },
        },
        awayTeam: awayStats ?? {
          teamId: away.team.id,
          teamName: away.team.displayName,
          wins: 0, losses: 0,
          last10: { wins: 0, losses: 0 },
          homeRecord: { wins: 0, losses: 0 },
          awayRecord: { wins: 0, losses: 0 },
        },
        homeWins: homeSeriesEntry?.wins ?? 0,
        awayWins: awaySeriesEntry?.wins ?? 0,
        currentGame: (home.linescores?.length ?? 0) + 1,
        homeCourtTeam: home.team.id,
      });
    }

    return series;
  } catch {
    espnLimiter.recordFailure();
    return [];
  }
}
