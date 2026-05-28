import { describe, it, expect } from 'vitest';

// Test the pure math functions in isolation
const computeWinRate = (wins: number, losses: number) => {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
};

const computeEV = (modelProb: number, marketPrice: number) =>
  modelProb / marketPrice - 1;

describe('series probability math', () => {
  it('returns 0.5 for a team with no record', () => {
    expect(computeWinRate(0, 0)).toBe(0.5);
  });

  it('returns correct win rate', () => {
    expect(computeWinRate(60, 22)).toBeCloseTo(0.732, 2);
  });
});

describe('EV calculation', () => {
  it('returns positive EV when model prob > market price', () => {
    expect(computeEV(0.65, 0.55)).toBeGreaterThan(0);
  });

  it('returns negative EV when model prob < market price', () => {
    expect(computeEV(0.40, 0.55)).toBeLessThan(0);
  });

  it('returns zero EV at fair price', () => {
    expect(computeEV(0.55, 0.55)).toBeCloseTo(0, 2);
  });
});
