import { tracker } from '../portfolio/index.js';
import { TradeDecision } from '../types.js';

/**
 * Portfolio exposure limits — caps total and per-team exposure.
 *
 * Team extraction strategy (in priority order):
 *  1. Signal metadata (EV: outcome label, ARB: marketA outcome) — works for real hex tokenIds
 *  2. TokenId dash-split convention (e.g. "a-series-OKC") — works for test mocks / legacy IDs
 */

export interface LimitsResult {
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
    // fall through
  }
  const parts = decision.tokenId.split('-');
  return parts.length > 1 ? (parts[parts.length - 1] ?? 'unknown').toLowerCase() : 'unknown';
}

function extractTeamFromTokenId(tokenId: string): string {
  const parts = tokenId.split('-');
  return parts.length > 1 ? (parts[parts.length - 1] ?? 'unknown').toLowerCase() : 'unknown';
}

/**
 * Check portfolio-level exposure caps.
 */
export function checkLimits(
  decision: TradeDecision,
  maxPortfolioExposureUsdc: number,
  maxSingleTeamExposureUsdc: number,
): LimitsResult {
  const openPositions = tracker.getOpenPositions();
  const totalExposure = openPositions.reduce((sum, p) => sum + p.size, 0);

  // Check total portfolio exposure
  if (totalExposure + decision.sizeUsdc > maxPortfolioExposureUsdc) {
    return {
      allowed: false,
      reason: `Portfolio exposure would be ${(totalExposure + decision.sizeUsdc).toFixed(2)} USDC, exceeds cap of ${maxPortfolioExposureUsdc} USDC`,
    };
  }

  // Check per-team exposure
  const newTeam = extractTeamFromDecision(decision);
  if (newTeam !== 'unknown') {
    let teamExposure = 0;
    for (const pos of openPositions) {
      if (extractTeamFromTokenId(pos.tokenId) === newTeam) {
        teamExposure += pos.size;
      }
    }
    if (teamExposure + decision.sizeUsdc > maxSingleTeamExposureUsdc) {
      return {
        allowed: false,
        reason: `Team ${newTeam.toUpperCase()} exposure would be ${(teamExposure + decision.sizeUsdc).toFixed(2)} USDC, exceeds cap of ${maxSingleTeamExposureUsdc} USDC`,
      };
    }
  }

  return { allowed: true };
}
