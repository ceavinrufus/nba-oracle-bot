import { describe, it, expect } from 'vitest';
import { kellySize } from '../src/execution/kelly.js';

describe('kellySize', () => {
  it('returns 0 for negative edge', () => {
    expect(kellySize(0.40, 0.55, 1000)).toBe(0);
  });

  it('returns positive size for positive edge', () => {
    expect(kellySize(0.65, 0.50, 1000)).toBeGreaterThan(0);
  });

  it('caps at maxBetUsdc', () => {
    // Strong edge, large bankroll → should cap
    const size = kellySize(0.90, 0.50, 100_000);
    expect(size).toBeLessThanOrEqual(10); // env.maxBetUsdc default
  });

  it('returns 0 for invalid price', () => {
    expect(kellySize(0.65, 0, 1000)).toBe(0);
    expect(kellySize(0.65, 1, 1000)).toBe(0);
  });
});
