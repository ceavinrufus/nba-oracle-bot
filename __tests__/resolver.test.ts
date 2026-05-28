import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/portfolio/index.js', () => ({
  tracker: {
    getOpenPositions: vi.fn(),
    closePosition: vi.fn(),
  },
}));

vi.mock('../src/data/polymarket.js', () => ({
  fetchNbaMarkets: vi.fn(),
  fetchMarketResolution: vi.fn(),
}));

import { resolveSettledPositions } from '../src/execution/resolver.js';
import { tracker } from '../src/portfolio/index.js';
import { fetchNbaMarkets, fetchMarketResolution } from '../src/data/polymarket.js';

const mockTracker = tracker as unknown as {
  getOpenPositions: ReturnType<typeof vi.fn>;
  closePosition: ReturnType<typeof vi.fn>;
};
const mockFetchMarkets = fetchNbaMarkets as ReturnType<typeof vi.fn>;
const mockFetchResolution = fetchMarketResolution as ReturnType<typeof vi.fn>;

const MARKET = {
  marketId: 'm1',
  conditionId: 'cond1',
  question: 'Lakers win?',
  outcomes: [
    { tokenId: 'tok-yes', outcome: 'Yes', price: 0.6 },
    { tokenId: 'tok-no', outcome: 'No', price: 0.4 },
  ],
  liquidity: 10000,
  volume24h: 5000,
  closeTime: Date.now() + 86400000,
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchMarkets.mockResolvedValue([MARKET]);
});

describe('resolveSettledPositions', () => {
  it('closes a winning position with resolvedPrice=1.0', async () => {
    mockTracker.getOpenPositions.mockReturnValue([
      { tokenId: 'tok-yes', side: 'BUY', price: 0.6, size: 100, enteredAt: Date.now(), status: 'open' },
    ]);
    mockFetchResolution.mockResolvedValue({
      conditionId: 'cond1', resolved: true, winnerTokenId: 'tok-yes', resolvedAt: Date.now(),
    });

    await resolveSettledPositions();

    expect(mockTracker.closePosition).toHaveBeenCalledWith('tok-yes', 1.0);
  });

  it('closes a losing position with resolvedPrice=0.0', async () => {
    mockTracker.getOpenPositions.mockReturnValue([
      { tokenId: 'tok-no', side: 'BUY', price: 0.4, size: 100, enteredAt: Date.now(), status: 'open' },
    ]);
    mockFetchResolution.mockResolvedValue({
      conditionId: 'cond1', resolved: true, winnerTokenId: 'tok-yes', resolvedAt: Date.now(),
    });

    await resolveSettledPositions();

    expect(mockTracker.closePosition).toHaveBeenCalledWith('tok-no', 0.0);
  });

  it('skips positions not in any market', async () => {
    mockTracker.getOpenPositions.mockReturnValue([
      { tokenId: 'unknown-token', side: 'BUY', price: 0.5, size: 100, enteredAt: Date.now(), status: 'open' },
    ]);

    await resolveSettledPositions();

    expect(mockFetchResolution).not.toHaveBeenCalled();
    expect(mockTracker.closePosition).not.toHaveBeenCalled();
  });

  it('skips unresolved markets', async () => {
    mockTracker.getOpenPositions.mockReturnValue([
      { tokenId: 'tok-yes', side: 'BUY', price: 0.6, size: 100, enteredAt: Date.now(), status: 'open' },
    ]);
    mockFetchResolution.mockResolvedValue({
      conditionId: 'cond1', resolved: false, winnerTokenId: null, resolvedAt: null,
    });

    await resolveSettledPositions();

    expect(mockTracker.closePosition).not.toHaveBeenCalled();
  });

  it('deduplicates conditionId checks — only calls fetchMarketResolution once per conditionId', async () => {
    mockTracker.getOpenPositions.mockReturnValue([
      { tokenId: 'tok-yes', side: 'BUY', price: 0.6, size: 60, enteredAt: Date.now(), status: 'open' },
      { tokenId: 'tok-no', side: 'BUY', price: 0.4, size: 40, enteredAt: Date.now(), status: 'open' },
    ]);
    mockFetchResolution.mockResolvedValue({
      conditionId: 'cond1', resolved: true, winnerTokenId: 'tok-yes', resolvedAt: Date.now(),
    });

    await resolveSettledPositions();

    expect(mockFetchResolution).toHaveBeenCalledTimes(1);
    expect(mockTracker.closePosition).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no open positions', async () => {
    mockTracker.getOpenPositions.mockReturnValue([]);

    await resolveSettledPositions();

    expect(mockFetchMarkets).not.toHaveBeenCalled();
  });
});
