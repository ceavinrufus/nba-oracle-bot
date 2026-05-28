import { describe, it, expect } from 'vitest';
import {
  addPosition,
  closePosition,
  getOpenPositions,
  getClosedPositions,
  hasPosition,
  calculatePositionPnl,
  type PositionStore,
  type Position,
} from '../src/portfolio/tracker.js';

const emptyStore: PositionStore = { positions: [] };

function makePos(overrides: Partial<Position> = {}): Omit<Position, 'status'> {
  return {
    tokenId: 'token-moneyline-OKC',
    side: 'BUY',
    price: 0.6,
    size: 10,
    enteredAt: Date.now(),
    ...overrides,
  };
}

describe('portfolio/tracker', () => {
  it('addPosition adds to empty store', () => {
    const store = addPosition(emptyStore, makePos());
    expect(store.positions).toHaveLength(1);
    expect(store.positions[0].status).toBe('open');
  });

  it('addPosition deduplicates by tokenId', () => {
    let store = addPosition(emptyStore, makePos());
    store = addPosition(store, makePos());
    expect(store.positions).toHaveLength(1);
  });

  it('allows same tokenId after closing', () => {
    let store = addPosition(emptyStore, makePos());
    store = closePosition(store, 'token-moneyline-OKC', 1.0);
    store = addPosition(store, makePos());
    expect(store.positions).toHaveLength(2);
    expect(getOpenPositions(store)).toHaveLength(1);
    expect(getClosedPositions(store)).toHaveLength(1);
  });

  it('closePosition calculates pnl for BUY', () => {
    let store = addPosition(emptyStore, makePos({ price: 0.5, size: 10 }));
    store = closePosition(store, 'token-moneyline-OKC', 1.0);
    const closed = getClosedPositions(store)[0];
    // shares = 10 / 0.5 = 20, pnl = (1.0 - 0.5) * 20 = 10
    expect(closed.pnl).toBe(10);
  });

  it('closePosition calculates pnl for SELL', () => {
    let store = addPosition(emptyStore, makePos({ side: 'SELL', price: 0.8, size: 8 }));
    store = closePosition(store, 'token-moneyline-OKC', 0.2);
    const closed = getClosedPositions(store)[0];
    // shares = 8 / 0.8 = 10, pnl = (0.8 - 0.2) * 10 = 6
    expect(closed.pnl).toBeCloseTo(6);
  });

  it('hasPosition returns false for empty store', () => {
    expect(hasPosition(emptyStore, 'xyz')).toBe(false);
  });

  it('hasPosition returns true for open position', () => {
    const store = addPosition(emptyStore, makePos());
    expect(hasPosition(store, 'token-moneyline-OKC')).toBe(true);
  });

  it('calculatePositionPnl handles loss', () => {
    const pos: Position = { tokenId: 'x', side: 'BUY', price: 0.7, size: 7, enteredAt: 0, status: 'open' };
    // shares = 7/0.7 = 10, pnl = (0.3 - 0.7) * 10 = -4
    expect(calculatePositionPnl(pos, 0.3)).toBeCloseTo(-4);
  });
});
