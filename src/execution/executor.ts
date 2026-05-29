import axios from 'axios';
import { env, getMode, requireLiveCredentials } from '../env.js';
import { TradeDecision, TradeResult } from '../types.js';
import { signOrder } from './signer.js';
import { checkRisk } from '../risk/index.js';
import { logger } from '../utils/logger.js';
import { tracker } from '../portfolio/index.js';
import { alerts } from '../utils/alerts.js';

const clob = axios.create({ baseURL: env.polymarketClobUrl });

export async function execute(decision: TradeDecision): Promise<TradeResult> {
  // SELL decisions exit existing positions — skip risk check (reducing exposure, not adding)
  if (decision.side !== 'SELL') {
    checkRisk(decision);
  }

  const base: Omit<TradeResult, 'status' | 'orderId' | 'fillPrice' | 'error'> = {
    decision,
    executedAt: Date.now(),
  };

  const mode = getMode();

  // SCAN MODE: just log the opportunity
  if (mode === 'scan') {
    logger.log({ ...base, status: 'skipped', executedAt: Date.now() });
    return { ...base, status: 'skipped' };
  }

  // DRY-RUN MODE: simulate
  if (mode === 'dry-run') {
    const result: TradeResult = {
      ...base,
      status: 'simulated',
      fillPrice: decision.price,
      orderId: `dry-${Date.now()}`,
    };
    logger.log(result);
    if (decision.side === 'SELL') {
      tracker.closePosition(decision.tokenId, decision.price);
    } else {
      tracker.addPosition({
        tokenId: decision.tokenId,
        team: decision.team,
        side: decision.side,
        price: decision.price,
        size: decision.sizeUsdc,
        enteredAt: Date.now(),
      });
    }
    console.log(`[DRY-RUN] ${decision.side} ${decision.sizeUsdc.toFixed(2)} USDC @ ${decision.price.toFixed(3)} — ${decision.reasoning}`);
    return result;
  }

  // LIVE MODE
  requireLiveCredentials();

  try {
    const signed = await signOrder({
      tokenId: decision.tokenId,
      side: decision.side,
      price: decision.price,
      sizeUsdc: decision.sizeUsdc,
    });

    const res = await clob.post<{ orderID: string; status: string }>('/order', signed);

    const result: TradeResult = {
      ...base,
      status: res.data.status === 'matched' ? 'filled' : 'pending',
      orderId: res.data.orderID,
      fillPrice: decision.price,
    };
    logger.log(result);
    if (result.status === 'filled') {
      if (decision.side === 'SELL') {
        tracker.closePosition(decision.tokenId, decision.price);
      } else {
        tracker.addPosition({
          tokenId: decision.tokenId,
          team: decision.team,
          side: decision.side,
          price: decision.price,
          size: decision.sizeUsdc,
          enteredAt: Date.now(),
        });
      }
      await alerts.trade(
        'Order Filled',
        `${decision.side} ${decision.sizeUsdc.toFixed(2)} USDC @ ${decision.price.toFixed(3)}`,
        { token: decision.tokenId.slice(0, 10), reasoning: decision.reasoning.slice(0, 80) }
      );
    }
    console.log(`[LIVE] Order ${res.data.orderID} — ${res.data.status}`);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const result: TradeResult = { ...base, status: 'rejected', error };
    logger.log(result);
    await alerts.error('Order Rejected', error.slice(0, 200));
    console.error(`[LIVE] Order rejected: ${error}`);
    return result;
  }
}
