import { getOpenPositions, getClosedPositions, PositionStore } from './tracker.js';

export interface PnlSummary {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalInvested: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

/**
 * Calculate realized P&L from closed positions.
 */
export function realizedPnl(store: PositionStore): number {
  return getClosedPositions(store).reduce((sum, p) => sum + (p.pnl ?? 0), 0);
}

/**
 * Calculate unrealized P&L given current market prices.
 * @param currentPrices - Map of tokenId → current market price
 */
export function unrealizedPnl(
  store: PositionStore,
  currentPrices: Map<string, number>
): number {
  const open = getOpenPositions(store);
  let total = 0;
  for (const pos of open) {
    const currentPrice = currentPrices.get(pos.tokenId);
    if (currentPrice === undefined) continue;
    const shares = pos.size / pos.price;
    if (pos.side === 'BUY') {
      total += (currentPrice - pos.price) * shares;
    } else {
      total += (pos.price - currentPrice) * shares;
    }
  }
  return total;
}

/**
 * Full P&L summary.
 */
export function pnlSummary(
  store: PositionStore,
  currentPrices: Map<string, number>
): PnlSummary {
  const closed = getClosedPositions(store);
  const realized = realizedPnl(store);
  const unrealized = unrealizedPnl(store, currentPrices);
  const totalInvested = store.positions.reduce((sum, p) => sum + p.size, 0);

  const wins = closed.filter(p => (p.pnl ?? 0) > 0);
  const losses = closed.filter(p => (p.pnl ?? 0) < 0);

  return {
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    totalPnl: realized + unrealized,
    totalInvested,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: closed.length > 0 ? wins.length / closed.length : 0,
  };
}
