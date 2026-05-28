import { EventEmitter } from 'node:events';

/**
 * WebSocket streaming client for Polymarket CLOB.
 * Subscribes to real-time price updates for tracked token IDs.
 */

export interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

export interface PriceMoveEvent {
  tokenId: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  timestamp: number;
}

export interface WebSocketLike {
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
  readyState: number;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const POLYMARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const PRICE_MOVE_THRESHOLD = 0.01; // 1%
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export class PolymarketWebSocket extends EventEmitter {
  private ws: WebSocketLike | null = null;
  private priceCache: Map<string, PriceCacheEntry> = new Map();
  private trackedTokenIds: Set<string> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsFactory: WebSocketFactory;
  private url: string;
  private _connected = false;

  constructor(wsFactory: WebSocketFactory, url: string = POLYMARKET_WS_URL) {
    super();
    this.wsFactory = wsFactory;
    this.url = url;
  }

  get connected(): boolean {
    return this._connected;
  }

  getCache(): Map<string, PriceCacheEntry> {
    return this.priceCache;
  }

  getCachedPrice(tokenId: string): PriceCacheEntry | undefined {
    return this.priceCache.get(tokenId);
  }

  connect(): void {
    this.ws = this.wsFactory(this.url);

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      if (this.trackedTokenIds.size > 0) {
        this.subscribe([...this.trackedTokenIds]);
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      this.emit('error', err);
    };

    this.ws.onmessage = (ev) => {
      this.handleMessage(ev.data);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  trackTokens(tokenIds: string[]): void {
    for (const id of tokenIds) {
      this.trackedTokenIds.add(id);
    }
    if (this._connected) {
      this.subscribe(tokenIds);
    }
  }

  untrackTokens(tokenIds: string[]): void {
    for (const id of tokenIds) {
      this.trackedTokenIds.delete(id);
      this.priceCache.delete(id);
    }
  }

  private subscribe(tokenIds: string[]): void {
    if (!this.ws || !this._connected) return;
    const msg = JSON.stringify({
      assets_ids: tokenIds,
      type: 'market',
    });
    this.ws.send(msg);
  }

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw);
      // Polymarket sends price updates as array or single objects
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const tokenId = update.asset_id ?? update.token_id;
        const price = parseFloat(update.price);

        if (!tokenId || isNaN(price)) continue;
        if (!this.trackedTokenIds.has(tokenId)) continue;

        const oldEntry = this.priceCache.get(tokenId);
        const now = Date.now();

        this.priceCache.set(tokenId, { price, timestamp: now });

        if (oldEntry) {
          const changePercent = Math.abs(price - oldEntry.price) / oldEntry.price;
          if (changePercent >= PRICE_MOVE_THRESHOLD) {
            const event: PriceMoveEvent = {
              tokenId,
              oldPrice: oldEntry.price,
              newPrice: price,
              changePercent,
              timestamp: now,
            };
            this.emit('priceMove', event);
          }
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectTimer = setTimeout(() => {
      this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
      this.connect();
    }, delay);
  }
}

/**
 * Updated fetchMarketsWithPrices that uses WS cache when available.
 */
export function createCachedPriceFetcher(wsClient: PolymarketWebSocket) {
  return function applyCache(markets: Array<{ outcomes: Array<{ tokenId: string; price: number }> }>) {
    return markets.map(m => ({
      ...m,
      outcomes: m.outcomes.map(o => {
        const cached = wsClient.getCachedPrice(o.tokenId);
        return {
          ...o,
          price: cached ? cached.price : o.price,
        };
      }),
    }));
  };
}
