import { ArbSignal, TradeDecision, TradeResult } from '../types.js';
import { execute } from './executor.js';
import { kellySize } from './kelly.js';
import { alerts } from '../utils/alerts.js';

export interface ArbLegs {
  legA: TradeDecision;
  legB: TradeDecision;
}

export function buildArbLegs(signal: ArbSignal, bankrollUsdc: number): ArbLegs {
  // Kelly size for arb: use actualProb as model prob, marketA/B prices as market price
  // Use tighter sizing (cap via smaller bankroll fraction via direct cap)
  const rawA = kellySize(signal.actualProb, signal.marketA.price, bankrollUsdc);
  const rawB = kellySize(signal.actualProb, signal.marketB.price, bankrollUsdc);
  // Max 2% per leg
  const maxLeg = bankrollUsdc * 0.02;
  const sizeA = Math.min(rawA, maxLeg);
  const sizeB = Math.min(rawB, maxLeg);

  const legA: TradeDecision = {
    signal,
    tokenId: signal.marketA.tokenId,
    side: 'BUY',
    price: signal.marketA.price,
    sizeUsdc: sizeA,
    reasoning: `ARB leg A: ${signal.description} gap=${signal.gapSize.toFixed(3)}`,
  };

  const legB: TradeDecision = {
    signal,
    tokenId: signal.marketB.tokenId,
    side: 'BUY',
    price: signal.marketB.price,
    sizeUsdc: sizeB,
    reasoning: `ARB leg B: ${signal.description} gap=${signal.gapSize.toFixed(3)}`,
  };

  return { legA, legB };
}

export async function executeArb(
  signal: ArbSignal,
  bankrollUsdc: number
): Promise<{ legA: TradeResult; legB: TradeResult } | null> {
  if (signal.gapSize < 0.02) {
    console.log(`[ARB] Gap too small (${signal.gapSize.toFixed(3)}), skipping`);
    return null;
  }

  const { legA, legB } = buildArbLegs(signal, bankrollUsdc);

  if (legA.sizeUsdc < 1 || legB.sizeUsdc < 1) {
    console.log(`[ARB] Size too small, skipping`);
    return null;
  }

  console.log(`[ARB] Placing dual legs: A=${legA.sizeUsdc.toFixed(2)} USDC @ ${legA.price.toFixed(3)} | B=${legB.sizeUsdc.toFixed(2)} USDC @ ${legB.price.toFixed(3)}`);

  // Place both legs simultaneously
  const [resultA, resultB] = await Promise.all([
    execute(legA),
    execute(legB),
  ]);

  const bothFilled = resultA.status !== 'rejected' && resultB.status !== 'rejected';
  if (!bothFilled) {
    await alerts.warn(
      'ARB Partial Fill',
      `Leg A: ${resultA.status} | Leg B: ${resultB.status}. Manual check required.`
    );
  } else {
    await alerts.trade(
      'ARB Executed',
      signal.description,
      { gapSize: signal.gapSize, legAPrice: legA.price, legBPrice: legB.price }
    );
  }

  return { legA: resultA, legB: resultB };
}
