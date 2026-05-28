import axios from 'axios';
import { env } from '../env.js';
import { TeamStats, InjuryReport, SeriesState } from '../types.js';

const espn = axios.create({ baseURL: env.espnNbaUrl });

// ─── Injury Reports ───────────────────────────────────────────────────────────

export async function fetchInjuryReports(): Promise<InjuryReport[]> {
  try {
    const res = await espn.get('/injuries');
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
    const res = await espn.get(`/teams/${teamId}`);
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
    return null;
  }
}

// ─── Playoff Series ───────────────────────────────────────────────────────────

export async function fetchPlayoffSeries(): Promise<SeriesState[]> {
  try {
    const res = await espn.get('/scoreboard', {
      params: { seasontype: 3 }, // postseason
    });

    const series: SeriesState[] = [];

    const events = res.data?.events ?? [];
    const entries: Array<{ event: typeof events[0]; home: { team: { id: string; displayName: string }; record?: { items?: Array<{ type: string; summary?: string }> }; linescores?: unknown[] }; away: { team: { id: string; displayName: string }; record?: { items?: Array<{ type: string; summary?: string }> }; linescores?: unknown[] } }> = [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');
      if (!home || !away) continue;

      entries.push({ event, home, away });
    }

    // Fetch all team stats in parallel
    const teamStatsResults = await Promise.all(
      entries.flatMap(e => [fetchTeamStats(e.home.team.id), fetchTeamStats(e.away.team.id)])
    );

    for (let i = 0; i < entries.length; i++) {
      const { event, home, away } = entries[i]!;
      const homeStats = teamStatsResults[i * 2];
      const awayStats = teamStatsResults[i * 2 + 1];

      const homeSeries = home.record?.items?.find((r: { type: string }) => r.type === 'playoff') ?? home.record?.items?.find((r: { type: string }) => r.type === 'vsconf');
      const awaySeries = away.record?.items?.find((r: { type: string }) => r.type === 'playoff') ?? away.record?.items?.find((r: { type: string }) => r.type === 'vsconf');

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
        homeWins: homeSeries?.summary ? parseInt(homeSeries.summary.split('-')[0] ?? '0') : 0,
        awayWins: awaySeries?.summary ? parseInt(awaySeries.summary.split('-')[0] ?? '0') : 0,
        currentGame: (home.linescores?.length ?? 0) + 1,
        homeCourtTeam: home.team.id,
      });
    }

    return series;
  } catch {
    return [];
  }
}
