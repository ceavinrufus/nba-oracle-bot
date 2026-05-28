import { Market, SeriesState, EVSignal } from '../types.js';
import { fetchPlayoffSeries } from '../data/espn.js';
import { env } from '../env.js';

/**
 * Series Probability Engine
 *
 * Computes win probability using:
 * - Season win rate (W / W+L)
 * - Recent form (last 10 games, weighted 2x)
 * - Home court advantage (+5%)
 * - Series momentum (lead in series = confidence boost)
 *
 * Compares model probability to Polymarket implied price.
 * Signals EV opportunity if gap > MIN_EV_THRESHOLD.
 */

function computeWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
}

function computeSeriesProbability(series: SeriesState, forTeam: 'home' | 'away'): number {
  const team = forTeam === 'home' ? series.homeTeam : series.awayTeam;
  const opp = forTeam === 'home' ? series.awayTeam : series.homeTeam;

  // Base win rate
  const teamRate = computeWinRate(team.wins, team.losses);
  const oppRate = computeWinRate(opp.wins, opp.losses);

  // Recent form (last 10, weighted 2x)
  const teamForm = computeWinRate(team.last10.wins, team.last10.losses);
  const oppForm = computeWinRate(opp.last10.wins, opp.last10.losses);

  // Weighted combination (50% season, 30% form, 20% home court)
  const teamScore = 0.5 * teamRate + 0.3 * teamForm + (forTeam === 'home' ? 0.2 : 0);
  const oppScore = 0.5 * oppRate + 0.3 * oppForm + (forTeam === 'away' ? 0.2 : 0);

  // Series lead momentum
  const teamSeriesWins = forTeam === 'home' ? series.homeWins : series.awayWins;
  const oppSeriesWins = forTeam === 'home' ? series.awayWins : series.homeWins;
  const seriesLead = (teamSeriesWins - oppSeriesWins) * 0.03; // 3% per game lead

  const rawProb = teamScore / (teamScore + oppScore) + seriesLead;
  return Math.max(0.05, Math.min(0.95, rawProb));
}

function computeEV(modelProb: number, marketPrice: number): number {
  // EV = p * (1/price - 1) - (1-p)
  // Simplified: EV = modelProb / marketPrice - 1
  return (modelProb / marketPrice) - 1;
}

export async function scanSeriesEV(markets: Market[]): Promise<EVSignal[]> {
  const seriesList = await fetchPlayoffSeries();
  const signals: EVSignal[] = [];

  for (const series of seriesList) {
    for (const market of markets) {
      if (!market.active) continue;
      if (market.liquidity < env.minLiquidityUsd) continue;
      if (market.volume24h < env.minVolume24hUsd) continue;

      for (const outcome of market.outcomes) {
        const outcomeLower = outcome.outcome.toLowerCase();
        const isHome = outcomeLower.includes(series.homeTeam.teamName.toLowerCase());
        const isAway = outcomeLower.includes(series.awayTeam.teamName.toLowerCase());

        if (!isHome && !isAway) continue;
        if (outcome.price <= 0 || outcome.price >= 1) continue;

        const modelProb = computeSeriesProbability(series, isHome ? 'home' : 'away');
        const ev = computeEV(modelProb, outcome.price);
        const confidence = Math.min(0.9, Math.abs(modelProb - outcome.price) * 5);

        if (ev >= env.minEvThreshold && confidence >= env.minConfidence) {
          signals.push({
            type: 'EV',
            market,
            outcome,
            modelProbability: modelProb,
            impliedProbability: outcome.price,
            ev,
            confidence,
            detectedAt: Date.now(),
          });
        }
      }
    }
  }

  return signals;
}
