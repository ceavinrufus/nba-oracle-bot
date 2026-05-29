import axios from 'axios';
import { env } from '../env.js';
import { withRetry } from '../utils/retry.js';

export interface OddsOutcome {
  name: string;       // team name e.g. "Los Angeles Lakers"
  price: number;      // American odds e.g. -150 or +130
}

export interface OddsGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;       // 'h2h' = moneyline
      outcomes: OddsOutcome[];
    }>;
  }>;
}

export function americanToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

export function averageImpliedProb(outcomes: OddsOutcome[], teamName: string): number | null {
  const matching = outcomes.filter(o =>
    o.name.toLowerCase().includes(teamName.toLowerCase()) ||
    teamName.toLowerCase().includes(o.name.toLowerCase())
  );
  if (matching.length === 0) return null;
  const probs = matching.map(o => americanToImplied(o.price));
  return probs.reduce((a, b) => a + b, 0) / probs.length;
}

export async function fetchNBAOdds(): Promise<OddsGame[]> {
  if (!env.oddsApiKey) {
    console.warn('[ODDS-API] No API key configured, skipping');
    return [];
  }
  const url = `${env.oddsApiBase}/sports/basketball_nba/odds`;
  const params = {
    apiKey: env.oddsApiKey,
    regions: 'us',
    markets: 'h2h',
    oddsFormat: 'american',
  };
  return withRetry(async () => {
    const res = await axios.get<OddsGame[]>(url, { params, timeout: 10_000 });
    return res.data;
  });
}

export function getOddsModelProb(
  games: OddsGame[],
  homeTeam: string,
  awayTeam: string
): { home: number; away: number } | null {
  const game = games.find(g =>
    (g.home_team.includes(homeTeam) || homeTeam.includes(g.home_team.split(' ').pop()!)) &&
    (g.away_team.includes(awayTeam) || awayTeam.includes(g.away_team.split(' ').pop()!))
  );
  if (!game || game.bookmakers.length === 0) return null;

  // Average across all bookmakers
  const homeProbs: number[] = [];
  const awayProbs: number[] = [];

  for (const bookie of game.bookmakers) {
    const h2h = bookie.markets.find(m => m.key === 'h2h');
    if (!h2h) continue;
    const homeOutcome = h2h.outcomes.find(o => o.name === game.home_team);
    const awayOutcome = h2h.outcomes.find(o => o.name === game.away_team);
    if (homeOutcome) homeProbs.push(americanToImplied(homeOutcome.price));
    if (awayOutcome) awayProbs.push(americanToImplied(awayOutcome.price));
  }

  if (homeProbs.length === 0) return null;

  const homeAvg = homeProbs.reduce((a, b) => a + b, 0) / homeProbs.length;
  const awayAvg = awayProbs.reduce((a, b) => a + b, 0) / awayProbs.length;

  // Normalize to remove vig
  const total = homeAvg + awayAvg;
  return {
    home: homeAvg / total,
    away: awayAvg / total,
  };
}
