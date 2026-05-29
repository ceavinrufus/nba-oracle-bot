import { tracker } from '../portfolio/index.js';
import { Position } from '../portfolio/tracker.js';
import { execute } from './executor.js';
import { alerts } from '../utils/alerts.js';
import { Signal, TradeDecision } from '../types.js';

export interface ExitConfig {
  stopLossPct: number;   // e.g. 0.25 = exit if position down 25%
  takeProfitPct: number; // e.g. 0.50 = exit if position up 50%
}

const DEFAULT_CONFIG: ExitConfig = {
  stopLossPct: parseFloat(process.env.STOP_LOSS_PCT ?? '0.25'),
  takeProfitPct: parseFloat(process.env.TAKE_PROFIT_PCT ?? '0.50'),
};

export function shouldStopLoss(pos: Position, currentPrice: number, config = DEFAULT_CONFIG): boolean {
  if (pos.side !== 'BUY') return false;
  const pnlPct = (currentPrice - pos.price) / pos.price;
  return pnlPct <= -config.stopLossPct;
}

export function shouldTakeProfit(pos: Position, currentPrice: number, config = DEFAULT_CONFIG): boolean {
  if (pos.side !== 'BUY') return false;
  const pnlPct = (currentPrice - pos.price) / pos.price;
  return pnlPct >= config.takeProfitPct;
}

export async function checkExits(
  currentPrices: Map<string, number>,
  config = DEFAULT_CONFIG
): Promise<void> {
  const open = tracker.getOpenPositions();

  for (const pos of open) {
    const currentPrice = currentPrices.get(pos.tokenId);
    if (currentPrice === undefined) continue;

    const stopLoss = shouldStopLoss(pos, currentPrice, config);
    const takeProfit = shouldTakeProfit(pos, currentPrice, config);

    if (!stopLoss && !takeProfit) continue;

    const reason = stopLoss ? 'STOP_LOSS' : 'TAKE_PROFIT';
    const pnlPct = ((currentPrice - pos.price) / pos.price * 100).toFixed(1);

    console.log(`[EXIT] ${reason} triggered for ${pos.tokenId}: entry=${pos.price.toFixed(3)} current=${currentPrice.toFixed(3)} pnl=${pnlPct}%`);

    // Build a synthetic SELL decision
    const syntheticSignal: Signal = {
      type: 'EV',
      market: { marketId: '', conditionId: '', question: reason, outcomes: [], liquidity: 0, volume24h: 0, closeTime: 0, active: false },
      outcome: { tokenId: pos.tokenId, outcome: reason, price: currentPrice },
      modelProbability: currentPrice,
      impliedProbability: currentPrice,
      ev: 0,
      confidence: 1,
      detectedAt: Date.now(),
    };

    const decision: TradeDecision = {
      signal: syntheticSignal,
      tokenId: pos.tokenId,
      team: pos.team,
      side: 'SELL',
      price: currentPrice,
      sizeUsdc: pos.size,
      reasoning: `${reason}: entry=${pos.price.toFixed(3)} current=${currentPrice.toFixed(3)} pnl=${pnlPct}%`,
    };

    try {
      await execute(decision);
      await alerts.trade(
        `Exit: ${reason}`,
        `Token ${pos.tokenId.slice(0, 10)} — PnL ${pnlPct}%`,
        { entry: pos.price, current: currentPrice }
      );
    } catch (err) {
      console.error(`[EXIT] Failed to execute exit for ${pos.tokenId}:`, err);
    }
  }
}
