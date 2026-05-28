import { describe, it, expect, beforeEach } from 'vitest';
import { PolymarketWebSocket, WebSocketLike, PriceMoveEvent } from '../src/data/polymarket-ws.js';

class MockWebSocket implements WebSocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  // Test helpers
  simulateOpen(): void {
    this.onopen?.({});
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(): void {
    this.onclose?.({});
  }
}

describe('PolymarketWebSocket', () => {
  let mockWs: MockWebSocket;
  let client: PolymarketWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket();
    client = new PolymarketWebSocket(() => mockWs, 'wss://test');
  });

  it('connects and emits connected event', () => {
    let connected = false;
    client.on('connected', () => { connected = true; });
    client.connect();
    mockWs.simulateOpen();
    expect(connected).toBe(true);
    expect(client.connected).toBe(true);
  });

  it('subscribes to tracked tokens on connect', () => {
    client.trackTokens(['token1', 'token2']);
    client.connect();
    mockWs.simulateOpen();
    expect(mockWs.sent).toHaveLength(1);
    const msg = JSON.parse(mockWs.sent[0]);
    expect(msg.assets_ids).toEqual(['token1', 'token2']);
    expect(msg.type).toBe('market');
  });

  it('updates price cache on message', () => {
    client.trackTokens(['token1']);
    client.connect();
    mockWs.simulateOpen();
    mockWs.simulateMessage({ asset_id: 'token1', price: '0.65' });
    const entry = client.getCachedPrice('token1');
    expect(entry).toBeDefined();
    expect(entry!.price).toBe(0.65);
  });

  it('emits priceMove when change > 1%', () => {
    const moves: PriceMoveEvent[] = [];
    client.on('priceMove', (ev: PriceMoveEvent) => moves.push(ev));
    client.trackTokens(['token1']);
    client.connect();
    mockWs.simulateOpen();
    // Set initial price
    mockWs.simulateMessage({ asset_id: 'token1', price: '0.50' });
    // Small move - no event
    mockWs.simulateMessage({ asset_id: 'token1', price: '0.504' });
    expect(moves).toHaveLength(0);
    // Big move - event
    mockWs.simulateMessage({ asset_id: 'token1', price: '0.52' });
    expect(moves).toHaveLength(1);
    expect(moves[0].changePercent).toBeGreaterThanOrEqual(0.01);
  });

  it('ignores messages for untracked tokens', () => {
    client.trackTokens(['token1']);
    client.connect();
    mockWs.simulateOpen();
    mockWs.simulateMessage({ asset_id: 'token2', price: '0.70' });
    expect(client.getCachedPrice('token2')).toBeUndefined();
  });

  it('attempts reconnect on close', async () => {
    let reconnecting = false;
    client.on('reconnecting', () => { reconnecting = true; });
    client.connect();
    mockWs.simulateOpen();
    mockWs.simulateClose();
    expect(client.connected).toBe(false);
    // Wait for reconnect timer
    await new Promise(r => setTimeout(r, 1200));
    expect(reconnecting).toBe(true);
    client.disconnect();
  });

  it('disconnect stops reconnection', () => {
    client.connect();
    mockWs.simulateOpen();
    client.disconnect();
    expect(client.connected).toBe(false);
  });
});
