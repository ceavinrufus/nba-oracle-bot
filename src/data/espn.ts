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

    for (const event of res.data?.events ?? []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'home');
      const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === 'away');
      if (!home || !away) continue;

      const homeSeries = home.record?.items?.find((r: { type: string }) => r.type === 'vsconf');
      const awaySeries = away.record?.items?.find((r: { type: string }) => r.type === 'vsconf');

      series.push({
        seriesId: event.id,
        homeTeam: await fetchTeamStats(home.team.id) ?? {
          teamId: home.team.id,
          teamName: home.team.displayName,
          wins: 0, losses: 0,
          last10: { wins: 0, losses: 0 },
          homeRecord: { wins: 0, losses: 0 },
          awayRecord: { wins: 0, losses: 0 },
        },
        awayTeam: await fetchTeamStats(away.team.id) ?? {
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
