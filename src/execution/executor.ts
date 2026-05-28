import axios from 'axios';
import { env, getMode, requireLiveCredentials } from '../env.js';
import { TradeDecision, TradeResult } from '../types.js';
import { signOrder } from './signer.js';
import { checkKillSwitch } from './kill-switch.js';
import { logger } from '../utils/logger.js';

const clob = axios.create({ baseURL: env.polymarketClobUrl });

export async function execute(decision: TradeDecision): Promise<TradeResult> {
  checkKillSwitch();

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
    console.log(`[LIVE] Order ${res.data.orderID} — ${res.data.status}`);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const result: TradeResult = { ...base, status: 'rejected', error };
    logger.log(result);
    console.error(`[LIVE] Order rejected: ${error}`);
    return result;
  }
}
