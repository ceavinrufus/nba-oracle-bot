import { Market, SeriesState, EVSignal, InjuryReport } from '../types.js';
import { fetchPlayoffSeries } from '../data/espn.js';
import { resolveTeam } from '../data/teams.js';
import { env } from '../env.js';
import { OddsGame, getOddsModelProb } from '../data/odds-api.js';

/**
 * Series Probability Engine V2
 *
 * Upgraded model with:
 * - Season win rate: 40%
 * - Last 10 form: 25%
 * - Home court: 15%
 * - Player impact (injuries): 10%
 * - Series lead momentum: 5% per win lead
 * - Rest days: 5%
 */

function computeWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
}

export interface SeriesProbabilityOptions {
  restDays?: number;            // Days of rest for the team (0 = back-to-back)
  playoffAppearances5yr?: number; // Playoff appearances in last 5 years (0-5)
}

/**
 * Compute injury impact factor.
 * HIGH urgency (star OUT) = -15% to team win prob
 * MEDIUM urgency (key player DOUBTFUL) = -8%
 */
export function computeInjuryImpact(
  injuries: InjuryReport[],
  teamName: string,
): number {
  let impact = 0;
  for (const inj of injuries) {
    if (inj.teamName.toLowerCase() !== teamName.toLowerCase()) continue;
    if (inj.status === 'OUT') {
      impact -= 0.15;
    } else if (inj.status === 'DOUBTFUL') {
      impact -= 0.08;
    }
  }
  // Cap the negative impact at -30%
  return Math.max(-0.30, impact);
}

/**
 * Compute rest days adjustment.
 * 0 days rest = -3% adjustment
 * 1+ days rest = no adjustment
 */
export function computeRestDaysAdjustment(restDays?: number): number {
  if (restDays === undefined) return 0;
  if (restDays === 0) return -0.03;
  return 0;
}

/**
 * Compute playoff experience factor.
 * More appearances in last 5 years = +2% max
 */
export function computePlayoffExperienceFactor(appearances?: number): number {
  if (appearances === undefined) return 0;
  // Scale: 5 appearances = full +2%, linear scale
  return Math.min(0.02, (appearances / 5) * 0.02);
}

/**
 * V2 series probability computation with injury and contextual adjustments.
 */
export function computeSeriesProbabilityV2(
  series: SeriesState,
  injuries: InjuryReport[],
  forTeam: 'home' | 'away',
  options: SeriesProbabilityOptions = {},
): number {
  const team = forTeam === 'home' ? series.homeTeam : series.awayTeam;
  const opp = forTeam === 'home' ? series.awayTeam : series.homeTeam;

  // Base win rate (40%)
  const teamRate = computeWinRate(team.wins, team.losses);
  const oppRate = computeWinRate(opp.wins, opp.losses);

  // Recent form - last 10 (25%)
  const teamForm = computeWinRate(team.last10.wins, team.last10.losses);
  const oppForm = computeWinRate(opp.last10.wins, opp.last10.losses);

  // Home court for this game (15%)
  const homeCourt = forTeam === 'home' ? 0.54 : 0.46;

  // Weighted base score
  const teamScore = 0.40 * teamRate + 0.25 * teamForm + 0.15 * homeCourt;
  const oppScore = 0.40 * oppRate + 0.25 * oppForm + 0.15 * (1 - homeCourt);

  let rawProb = teamScore / (teamScore + oppScore);

  // Series lead momentum: 5% per win lead
  const teamSeriesWins = forTeam === 'home' ? series.homeWins : series.awayWins;
  const oppSeriesWins = forTeam === 'home' ? series.awayWins : series.homeWins;
  rawProb += (teamSeriesWins - oppSeriesWins) * 0.05;

  // Player impact factor (10% weight category)
  const teamInjuryImpact = computeInjuryImpact(injuries, team.teamName);
  const oppInjuryImpact = computeInjuryImpact(injuries, opp.teamName);
  rawProb += teamInjuryImpact - oppInjuryImpact;

  // Rest days (5% weight category)
  rawProb += computeRestDaysAdjustment(options.restDays);

  // Playoff experience
  rawProb += computePlayoffExperienceFactor(options.playoffAppearances5yr);

  return Math.max(0.05, Math.min(0.95, rawProb));
}

function computeEV(modelProb: number, marketPrice: number): number {
  return (modelProb / marketPrice) - 1;
}

export async function scanSeriesEVv2(
  markets: Market[],
  injuries: InjuryReport[] = [],
  oddsGames: OddsGame[] = [],
): Promise<EVSignal[]> {
  const seriesList = await fetchPlayoffSeries();
  const signals: EVSignal[] = [];

  for (const series of seriesList) {
    for (const market of markets) {
      if (!market.active) continue;
      if (market.liquidity < env.minLiquidityUsd) continue;
      if (market.volume24h < env.minVolume24hUsd) continue;

      for (const outcome of market.outcomes) {
        // For "Will [TEAM] win..." markets, outcomes are Yes/No — resolve team from question
        const outcomeLabel = outcome.outcome.toLowerCase();
        const isYes = outcomeLabel === 'yes';
        const isNo = outcomeLabel === 'no';

        let outcomeTeam = resolveTeam(outcome.outcome);

        // Fallback: if Yes/No market, extract team from question
        if (outcomeTeam === null && (isYes || isNo)) {
          outcomeTeam = resolveTeam(market.question);
        }

        const homeTeamId = resolveTeam(series.homeTeam.teamName);
        const awayTeamId = resolveTeam(series.awayTeam.teamName);
        const isHome = outcomeTeam !== null && homeTeamId !== null && outcomeTeam === homeTeamId;
        const isAway = outcomeTeam !== null && awayTeamId !== null && outcomeTeam === awayTeamId;

        // For Yes/No markets, only consider the YES outcome (win probability)
        if (isYes === false && (isHome || isAway) && outcomeLabel === 'no') continue;

        if (!isHome && !isAway) continue;
        if (outcome.price <= 0 || outcome.price >= 1) continue;

        const espnProb = computeSeriesProbabilityV2(
          series,
          injuries,
          isHome ? 'home' : 'away',
        );

        // Blend: 50% ESPN, 50% Odds API (when available)
        const oddsProb = getOddsModelProb(oddsGames, series.homeTeam.teamName, series.awayTeam.teamName);
        const blendedProb = oddsProb
          ? (espnProb * 0.5 + (isHome ? oddsProb.home : oddsProb.away) * 0.5)
          : espnProb;

        const modelProb = blendedProb;
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
