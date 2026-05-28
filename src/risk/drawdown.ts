import { tracker } from '../portfolio/index.js';
import { kill } from '../execution/kill-switch.js';

/**
 * Drawdown tracker — monitors daily/session P&L and triggers kill switch
 * if losses exceed MAX_DAILY_LOSS_USDC.
 */

let sessionStartTime = Date.now();
let sessionStartPnl = 0;

export function resetSession(): void {
  sessionStartTime = Date.now();
  sessionStartPnl = computeSessionPnl();
}

export function getSessionStartTime(): number {
  return sessionStartTime;
}

/**
 * Compute realized P&L for positions closed since session start.
 */
export function computeSessionPnl(): number {
  const positions = tracker.getAllPositions();
  let pnl = 0;
  for (const pos of positions) {
    if (pos.status === 'closed' && pos.closedAt && pos.closedAt >= sessionStartTime) {
      pnl += pos.pnl ?? 0;
    }
  }
  return pnl;
}

/**
 * Compute daily P&L (positions closed today).
 */
export function computeDailyPnl(): number {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const positions = tracker.getAllPositions();
  let pnl = 0;
  for (const pos of positions) {
    if (pos.status === 'closed' && pos.closedAt && pos.closedAt >= startOfDay) {
      pnl += pos.pnl ?? 0;
    }
  }
  return pnl;
}

/**
 * Check if drawdown exceeds maximum allowed daily loss.
 * Returns true if within limits, throws/kills if exceeded.
 */
export function checkDrawdown(maxDailyLossUsdc: number): void {
  const dailyPnl = computeDailyPnl();
  if (dailyPnl < -maxDailyLossUsdc) {
    kill(`Daily loss ${dailyPnl.toFixed(2)} USDC exceeds max allowed -${maxDailyLossUsdc} USDC`);
    throw new Error(`Drawdown limit exceeded: daily P&L is ${dailyPnl.toFixed(2)} USDC (max: -${maxDailyLossUsdc} USDC)`);
  }

  const sessionPnl = computeSessionPnl() - sessionStartPnl;
  if (sessionPnl < -maxDailyLossUsdc) {
    kill(`Session loss ${sessionPnl.toFixed(2)} USDC exceeds max allowed -${maxDailyLossUsdc} USDC`);
    throw new Error(`Drawdown limit exceeded: session P&L is ${sessionPnl.toFixed(2)} USDC (max: -${maxDailyLossUsdc} USDC)`);
  }
}
