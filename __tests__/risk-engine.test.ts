import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCorrelation } from '../src/risk/correlation.js';
import { checkLimits } from '../src/risk/limits.js';
import { checkDrawdown } from '../src/risk/drawdown.js';
import { TradeDecision, EVSignal } from '../src/types.js';

// Mock tracker
vi.mock('../src/portfolio/index.js', () => ({
  tracker: {
    getOpenPositions: vi.fn(() => []),
    getAllPositions: vi.fn(() => []),
  },
}));

import { tracker } from '../src/portfolio/index.js';

function makeDecision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    signal: { type: 'EV' } as EVSignal,
    tokenId: 'abc-series-OKC',
    side: 'BUY',
    price: 0.6,
    sizeUsdc: 10,
    reasoning: 'test',
    ...overrides,
  };
}

describe('Risk Engine - Correlation', () => {
  beforeEach(() => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([]);
  });

  it('allows trade when no existing positions', () => {
    const result = checkCorrelation(makeDecision());
    expect(result.allowed).toBe(true);
  });

  it('allows trade on same market type for same team', () => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([
      { tokenId: 'xyz-series-OKC', side: 'BUY', price: 0.5, size: 10, enteredAt: 1000, status: 'open' },
    ]);
    const result = checkCorrelation(makeDecision({ tokenId: 'def-series-OKC' }));
    expect(result.allowed).toBe(true);
  });

  it('blocks correlated positions (same team, different market type)', () => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([
      { tokenId: 'xyz-series-OKC', side: 'BUY', price: 0.5, size: 10, enteredAt: 1000, status: 'open' },
    ]);
    const result = checkCorrelation(makeDecision({ tokenId: 'def-game-OKC' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Correlated');
  });

  it('allows different teams', () => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([
      { tokenId: 'xyz-series-OKC', side: 'BUY', price: 0.5, size: 10, enteredAt: 1000, status: 'open' },
    ]);
    const result = checkCorrelation(makeDecision({ tokenId: 'def-game-BOS' }));
    expect(result.allowed).toBe(true);
  });
});

describe('Risk Engine - Limits', () => {
  beforeEach(() => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([]);
  });

  it('allows trade within limits', () => {
    const result = checkLimits(makeDecision({ sizeUsdc: 10 }), 100, 30);
    expect(result.allowed).toBe(true);
  });

  it('blocks trade exceeding portfolio exposure', () => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([
      { tokenId: 'a-series-BOS', side: 'BUY', price: 0.5, size: 95, enteredAt: 1000, status: 'open' },
    ]);
    const result = checkLimits(makeDecision({ sizeUsdc: 10 }), 100, 30);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Portfolio exposure');
  });

  it('blocks trade exceeding team exposure', () => {
    vi.mocked(tracker.getOpenPositions).mockReturnValue([
      { tokenId: 'a-series-OKC', side: 'BUY', price: 0.5, size: 25, enteredAt: 1000, status: 'open' },
    ]);
    const result = checkLimits(makeDecision({ sizeUsdc: 10 }), 100, 30);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Team OKC');
  });
});

describe('Risk Engine - Drawdown', () => {
  beforeEach(() => {
    vi.mocked(tracker.getAllPositions).mockReturnValue([]);
  });

  it('passes when no losses', () => {
    expect(() => checkDrawdown(50)).not.toThrow();
  });

  it('triggers kill switch when daily loss exceeds max', () => {
    const now = Date.now();
    vi.mocked(tracker.getAllPositions).mockReturnValue([
      { tokenId: 'a', side: 'BUY', price: 0.5, size: 100, enteredAt: now - 1000, closedAt: now - 500, status: 'closed', pnl: -60 },
    ]);
    expect(() => checkDrawdown(50)).toThrow('Drawdown limit exceeded');
  });
});
