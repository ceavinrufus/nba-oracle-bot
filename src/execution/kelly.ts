import { env } from '../env.js';

/**
 * Fractional Kelly Criterion position sizing.
 *
 * Kelly formula: f = (bp - q) / b
 *   b = net odds (1/price - 1)
 *   p = model probability
 *   q = 1 - p
 *
 * We use fractional Kelly (env.kellyFraction) to reduce variance.
 * Result is capped at env.maxBetUsdc.
 */
export function kellySize(
  modelProb: number,
  marketPrice: number,
  bankrollUsdc: number,
): number {
  if (marketPrice <= 0 || marketPrice >= 1) return 0;

  const b = (1 / marketPrice) - 1; // net odds
  const p = modelProb;
  const q = 1 - p;

  const kelly = (b * p - q) / b;

  if (kelly <= 0) return 0;

  const fractional = kelly * env.kellyFraction;
  const raw = fractional * bankrollUsdc;

  return Math.min(raw, env.maxBetUsdc);
}

export function estimateBankroll(usdcBalance: number): number {
  return usdcBalance;
}
