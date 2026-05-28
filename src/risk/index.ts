import { TradeDecision } from '../types.js';
import { checkKillSwitch } from '../execution/kill-switch.js';
import { checkDrawdown } from './drawdown.js';
import { checkCorrelation } from './correlation.js';
import { checkLimits } from './limits.js';
import { env } from '../env.js';

export { checkDrawdown, computeDailyPnl, computeSessionPnl, resetSession } from './drawdown.js';
export { checkCorrelation } from './correlation.js';
export { checkLimits } from './limits.js';

/**
 * Full risk check — replaces simple checkKillSwitch().
 * Validates kill switch, drawdown, correlation, and exposure limits.
 */
export function checkRisk(decision: TradeDecision): void {
  // 1. Kill switch (env var or runtime)
  checkKillSwitch();

  // 2. Drawdown check
  checkDrawdown(env.maxDailyLossUsdc);

  // 3. Correlation check
  const correlation = checkCorrelation(decision);
  if (!correlation.allowed) {
    throw new Error(`Risk: correlation check failed — ${correlation.reason}`);
  }

  // 4. Exposure limits
  const limits = checkLimits(decision, env.maxPortfolioExposureUsdc, env.maxSingleTeamExposureUsdc);
  if (!limits.allowed) {
    throw new Error(`Risk: limits check failed — ${limits.reason}`);
  }
}
