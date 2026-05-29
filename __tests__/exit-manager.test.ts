import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/portfolio/index.js', () => ({
  tracker: {
    getOpenPositions: vi.fn(),
  },
}));

vi.mock('../src/execution/executor.js', () => ({
  execute: vi.fn(),
}));

vi.mock('../src/utils/alerts.js', () => ({
  alerts: {
    trade: vi.fn(),
  },
}));

import { shouldStopLoss, shouldTakeProfit, checkExits, ExitConfig } from '../src/execution/exit-manager.js';
import { tracker } from '../src/portfolio/index.js';
import { execute } from '../src/execution/executor.js';
import { Position } from '../src/portfolio/tracker.js';

const mockTracker = tracker as unknown as { getOpenPositions: ReturnType<typeof vi.fn> };
const mockExecute = execute as ReturnType<typeof vi.fn>;

const CONFIG: ExitConfig = { stopLossPct: 0.25, takeProfitPct: 0.50 };

const makePos = (overrides: Partial<Position> = {}): Position => ({
  tokenId: 'tok-abc',
  side: 'BUY',
  price: 0.60,
  size: 100,
  enteredAt: Date.now(),
  status: 'open',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue({ status: 'simulated', executedAt: Date.now() });
});

describe('shouldStopLoss', () => {
  it('returns true when price drops below stop-loss threshold', () => {
    const pos = makePos({ price: 0.60 });
    // 0.60 → 0.44 is a ~26.7% drop — exceeds 25% stop
    expect(shouldStopLoss(pos, 0.44, CONFIG)).toBe(true);
  });

  it('returns false when price drop is within threshold', () => {
    const pos = makePos({ price: 0.60 });
    // 0.60 → 0.50 is ~16.7% drop — within 25% stop
    expect(shouldStopLoss(pos, 0.50, CONFIG)).toBe(false);
  });

  it('returns false for SELL positions', () => {
    const pos = makePos({ side: 'SELL', price: 0.60 });
    expect(shouldStopLoss(pos, 0.30, CONFIG)).toBe(false);
  });

  it('returns true at exactly the stop-loss threshold', () => {
    const pos = makePos({ price: 0.40 });
    // exactly 25% drop: 0.40 → 0.30
    expect(shouldStopLoss(pos, 0.30, CONFIG)).toBe(true);
  });
});

describe('shouldTakeProfit', () => {
  it('returns true when price rises above take-profit threshold', () => {
    const pos = makePos({ price: 0.40 });
    // 0.40 → 0.62 is 55% rise — exceeds 50% take-profit
    expect(shouldTakeProfit(pos, 0.62, CONFIG)).toBe(true);
  });

  it('returns false when price rise is below threshold', () => {
    const pos = makePos({ price: 0.40 });
    // 0.40 → 0.55 is 37.5% rise — below 50% take-profit
    expect(shouldTakeProfit(pos, 0.55, CONFIG)).toBe(false);
  });

  it('returns false for SELL positions', () => {
    const pos = makePos({ side: 'SELL', price: 0.40 });
    expect(shouldTakeProfit(pos, 0.80, CONFIG)).toBe(false);
  });
});

describe('checkExits', () => {
  it('calls execute with a SELL decision when stop-loss is triggered', async () => {
    const pos = makePos({ tokenId: 'tok-sl', price: 0.60, size: 50 });
    mockTracker.getOpenPositions.mockReturnValue([pos]);

    const prices = new Map([['tok-sl', 0.44]]); // ~26.7% drop
    await checkExits(prices, CONFIG);

    expect(mockExecute).toHaveBeenCalledOnce();
    const decision = mockExecute.mock.calls[0][0];
    expect(decision.side).toBe('SELL');
    expect(decision.tokenId).toBe('tok-sl');
    expect(decision.reasoning).toContain('STOP_LOSS');
  });

  it('calls execute with a SELL decision when take-profit is triggered', async () => {
    const pos = makePos({ tokenId: 'tok-tp', price: 0.40, size: 80 });
    mockTracker.getOpenPositions.mockReturnValue([pos]);

    const prices = new Map([['tok-tp', 0.62]]); // 55% rise
    await checkExits(prices, CONFIG);

    expect(mockExecute).toHaveBeenCalledOnce();
    const decision = mockExecute.mock.calls[0][0];
    expect(decision.side).toBe('SELL');
    expect(decision.reasoning).toContain('TAKE_PROFIT');
  });

  it('skips positions with no current price in the map', async () => {
    const pos = makePos({ tokenId: 'tok-noprice', price: 0.60 });
    mockTracker.getOpenPositions.mockReturnValue([pos]);

    const prices = new Map<string, number>(); // empty
    await checkExits(prices, CONFIG);

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('does not execute when neither stop-loss nor take-profit triggered', async () => {
    const pos = makePos({ tokenId: 'tok-ok', price: 0.60 });
    mockTracker.getOpenPositions.mockReturnValue([pos]);

    const prices = new Map([['tok-ok', 0.58]]); // ~3.3% drop — within thresholds
    await checkExits(prices, CONFIG);

    expect(mockExecute).not.toHaveBeenCalled();
  });
});
