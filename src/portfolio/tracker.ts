import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Position {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;        // USDC
  enteredAt: number;   // Unix timestamp ms
  closedAt?: number;
  resolvedPrice?: number;
  pnl?: number;
  status: 'open' | 'closed';
}

export interface PositionStore {
  positions: Position[];
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORE_PATH = resolve(process.cwd(), '.canon/positions.json');

function ensureDir(): void {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadStore(): PositionStore {
  ensureDir();
  if (!existsSync(STORE_PATH)) {
    return { positions: [] };
  }
  const raw = readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(raw) as PositionStore;
}

export function saveStore(store: PositionStore): void {
  ensureDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// ─── Pure Functions ──────────────────────────────────────────────────────────

export function getOpenPositions(store: PositionStore): Position[] {
  return store.positions.filter(p => p.status === 'open');
}

export function getClosedPositions(store: PositionStore): Position[] {
  return store.positions.filter(p => p.status === 'closed');
}

export function hasPosition(store: PositionStore, tokenId: string): boolean {
  return store.positions.some(p => p.tokenId === tokenId && p.status === 'open');
}

export function addPosition(
  store: PositionStore,
  pos: Omit<Position, 'status'>
): PositionStore {
  if (hasPosition(store, pos.tokenId)) {
    return store; // dedup: don't double-enter
  }
  return {
    positions: [...store.positions, { ...pos, status: 'open' }],
  };
}

export function closePosition(
  store: PositionStore,
  tokenId: string,
  resolvedPrice: number
): PositionStore {
  return {
    positions: store.positions.map(p => {
      if (p.tokenId !== tokenId || p.status !== 'open') return p;
      const pnl = calculatePositionPnl(p, resolvedPrice);
      return {
        ...p,
        status: 'closed' as const,
        closedAt: Date.now(),
        resolvedPrice,
        pnl,
      };
    }),
  };
}

export function calculatePositionPnl(pos: Position, resolvedPrice: number): number {
  // For a BUY: profit = (resolvedPrice - entryPrice) * shares
  // shares = size / entryPrice
  const shares = pos.size / pos.price;
  if (pos.side === 'BUY') {
    return (resolvedPrice - pos.price) * shares;
  }
  // SELL: profit when price goes down
  return (pos.price - resolvedPrice) * shares;
}

// ─── Stateful API (convenience wrappers) ─────────────────────────────────────

let _store: PositionStore | null = null;

function getStore(): PositionStore {
  if (!_store) {
    _store = loadStore();
  }
  return _store;
}

function persist(store: PositionStore): void {
  _store = store;
  saveStore(store);
}

export const tracker = {
  getOpenPositions(): Position[] {
    return getOpenPositions(getStore());
  },

  getClosedPositions(): Position[] {
    return getClosedPositions(getStore());
  },

  hasPosition(tokenId: string): boolean {
    return hasPosition(getStore(), tokenId);
  },

  addPosition(pos: Omit<Position, 'status'>): void {
    const updated = addPosition(getStore(), pos);
    persist(updated);
  },

  closePosition(tokenId: string, resolvedPrice: number): void {
    const updated = closePosition(getStore(), tokenId, resolvedPrice);
    persist(updated);
  },

  getAllPositions(): Position[] {
    return getStore().positions;
  },

  reload(): void {
    _store = loadStore();
  },
};
