import { tracker } from '../portfolio/index.js';
import { TradeDecision } from '../types.js';

/**
 * Correlation guard — prevents holding correlated positions.
 * E.g., don't hold both "OKC wins series" and "OKC wins Game 5" simultaneously.
 *
 * Team/market-type extraction strategy (in priority order):
 *  1. Signal metadata (EV: outcome label, ARB: marketA outcome) — works for real hex tokenIds
 *  2. TokenId dash-split convention (e.g. "abc-series-OKC") — works for test mocks / legacy IDs
 */

export interface CorrelationResult {
  allowed: boolean;
  reason?: string;
}

function extractTeamFromDecision(decision: TradeDecision): string {
  const { signal } = decision;
  try {
    if (signal.type === 'EV' && signal.outcome?.outcome) {
      return signal.outcome.outcome.toLowerCase();
    }
    if (signal.type === 'ARB' && signal.marketA?.outcome) {
      return signal.marketA.outcome.toLowerCase();
    }
  } catch {
    // fall through to tokenId-based
  }
  // Fallback: tokenId convention "prefix-marketType-TEAM"
  const parts = decision.tokenId.split('-');
  return parts.length > 1 ? (parts[parts.length - 1] ?? 'unknown').toLowerCase() : 'unknown';
}

function extractMarketTypeFromDecision(decision: TradeDecision): string {
  const { signal } = decision;
  try {
    if (signal.type === 'EV' && signal.market?.question) {
      const q = signal.market.question.toLowerCase();
      if (q.includes('series') || q.includes('advance')) return 'series';
      if (q.includes('game') || q.includes('tonight') || q.includes('moneyline')) return 'game';
      return 'general';
    }
  } catch {
    // fall through to tokenId-based
  }
  // Fallback: tokenId convention "prefix-marketType-TEAM"
  const parts = decision.tokenId.split('-');
  return parts.length > 2 ? (parts[1] ?? 'general') : 'general';
}

function extractTeamFromTokenId(tokenId: string): string {
  const parts = tokenId.split('-');
  return parts.length > 1 ? (parts[parts.length - 1] ?? 'unknown').toLowerCase() : 'unknown';
}

function extractMarketTypeFromTokenId(tokenId: string): string {
  const parts = tokenId.split('-');
  return parts.length > 2 ? (parts[1] ?? 'general') : 'general';
}

/**
 * Check if a new trade would create a correlated position.
 * Correlated = same team across different market types (e.g., series + game).
 */
export function checkCorrelation(decision: TradeDecision): CorrelationResult {
  const newTeam = extractTeamFromDecision(decision);
  const newMarketType = extractMarketTypeFromDecision(decision);

  if (newTeam === 'unknown') {
    return { allowed: true };
  }

  const openPositions = tracker.getOpenPositions();

  for (const pos of openPositions) {
    const existingTeam = extractTeamFromTokenId(pos.tokenId);
    const existingMarketType = extractMarketTypeFromTokenId(pos.tokenId);

    if (existingTeam === 'unknown') continue;

    // Same team, different market type = correlated
    if (existingTeam === newTeam && existingMarketType !== newMarketType) {
      return {
        allowed: false,
        reason: `Correlated position: already holding ${existingMarketType} position on ${existingTeam.toUpperCase()}, cannot add ${newMarketType} position`,
      };
    }
  }

  return { allowed: true };
}
