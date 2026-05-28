import { describe, it, expect } from 'vitest';
import { detectComplementaryArb } from '../src/agents/crossmarket-arb.js';
import { Market } from '../src/types.js';

const makeMarket = (yesPrice: number, noPrice: number): Market => ({
  marketId: 'test-mkt',
  conditionId: 'cond1',
  question: 'Will OKC win?',
  outcomes: [
    { tokenId: 'tok1', outcome: 'Yes', price: yesPrice },
    { tokenId: 'tok2', outcome: 'No', price: noPrice },
  ],
  liquidity: 5000,
  volume24h: 50000,
  closeTime: Date.now() / 1000 + 86400,
  active: true,
});

describe('detectComplementaryArb', () => {
  it('returns empty when prices sum to ~1.0', () => {
    const signals = detectComplementaryArb([makeMarket(0.52, 0.48)]);
    expect(signals).toHaveLength(0);
  });

  it('detects mispricing when prices sum to 0.9', () => {
    const signals = detectComplementaryArb([makeMarket(0.45, 0.45)]);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.gapSize).toBeGreaterThan(0.03);
  });

  it('ignores low-liquidity markets', () => {
    const market = { ...makeMarket(0.45, 0.45), liquidity: 500 };
    const signals = detectComplementaryArb([market]);
    expect(signals).toHaveLength(0);
  });
});
