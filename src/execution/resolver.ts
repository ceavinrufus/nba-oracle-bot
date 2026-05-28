import { tracker } from '../portfolio/index.js';
import { fetchMarketResolution, fetchNbaMarkets } from '../data/polymarket.js';

export async function resolveSettledPositions(): Promise<void> {
  const open = tracker.getOpenPositions();
  if (open.length === 0) return;

  // Get all active markets to find conditionIds for our positions
  const markets = await fetchNbaMarkets();
  const tokenToCondition = new Map<string, string>();
  for (const market of markets) {
    for (const outcome of market.outcomes) {
      tokenToCondition.set(outcome.tokenId, market.conditionId);
    }
  }

  // Deduplicate: check each conditionId once
  const conditionsChecked = new Set<string>();
  const resolutions = new Map<string, string | null>(); // conditionId -> winnerTokenId

  for (const pos of open) {
    const conditionId = tokenToCondition.get(pos.tokenId);
    if (!conditionId || conditionsChecked.has(conditionId)) continue;
    conditionsChecked.add(conditionId);
    const resolution = await fetchMarketResolution(conditionId);
    if (resolution.resolved) {
      resolutions.set(conditionId, resolution.winnerTokenId);
    }
  }

  // Close resolved positions
  for (const pos of open) {
    const conditionId = tokenToCondition.get(pos.tokenId);
    if (!conditionId || !resolutions.has(conditionId)) continue;
    const winnerTokenId = resolutions.get(conditionId)!;
    // resolvedPrice: 1.0 if our token won, 0.0 if it lost
    const resolvedPrice = winnerTokenId === pos.tokenId ? 1.0 : 0.0;
    tracker.closePosition(pos.tokenId, resolvedPrice);
    const pnl = (resolvedPrice - pos.price) * (pos.size / pos.price);
    console.log(`[RESOLVER] Closed ${pos.tokenId}: resolvedPrice=${resolvedPrice} pnl=${pnl.toFixed(2)} USDC`);
  }
}
