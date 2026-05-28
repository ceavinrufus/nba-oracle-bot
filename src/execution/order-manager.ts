import axios from 'axios';
import { env } from '../env.js';
import { TradeResult } from '../types.js';
import { tracker } from '../portfolio/index.js';
import { withRetry } from '../utils/retry.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const clob = axios.create({ baseURL: env.polymarketClobUrl });

const ORDERS_PATH = resolve(process.cwd(), '.canon/pending-orders.json');

export interface PendingOrder {
  orderId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  sizeUsdc: number;
  placedAt: number;   // ms
  team?: string;
}

interface OrderStore { orders: PendingOrder[]; }

function loadOrders(): OrderStore {
  const dir = dirname(ORDERS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(ORDERS_PATH)) return { orders: [] };
  return JSON.parse(readFileSync(ORDERS_PATH, 'utf-8')) as OrderStore;
}

function saveOrders(store: OrderStore): void {
  const dir = dirname(ORDERS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ORDERS_PATH, JSON.stringify(store, null, 2));
}

export function trackOrder(result: TradeResult): void {
  if (result.status !== 'pending' || !result.orderId) return;
  const store = loadOrders();
  const { decision } = result;
  store.orders.push({
    orderId: result.orderId,
    tokenId: decision.tokenId,
    side: decision.side,
    price: decision.price,
    sizeUsdc: decision.sizeUsdc,
    team: decision.team,
    placedAt: result.executedAt,
  });
  saveOrders(store);
}

export async function pollPendingOrders(staleSec = 120): Promise<void> {
  const store = loadOrders();
  if (store.orders.length === 0) return;

  const now = Date.now();
  const surviving: PendingOrder[] = [];

  for (const order of store.orders) {
    const ageMs = now - order.placedAt;
    const stale = ageMs > staleSec * 1000;

    let filled = false;
    let cancelled = false;

    try {
      const res = await withRetry(() =>
        clob.get<{ status: string; maker_amounts_filled?: string[] }>(`/order/${order.orderId}`)
      );
      const status = res.data.status;
      if (status === 'MATCHED' || status === 'matched') {
        filled = true;
      } else if (stale) {
        // Cancel stale order
        await withRetry(() => clob.delete(`/order/${order.orderId}`));
        cancelled = true;
        console.log(`[ORDER-MGR] Cancelled stale order ${order.orderId} (age: ${(ageMs / 1000).toFixed(0)}s)`);
      }
    } catch (err) {
      console.error(`[ORDER-MGR] Error checking order ${order.orderId}:`, err);
    }

    if (filled) {
      tracker.addPosition({
        tokenId: order.tokenId,
        team: order.team,
        side: order.side,
        price: order.price,
        size: order.sizeUsdc,
        enteredAt: order.placedAt,
      });
      console.log(`[ORDER-MGR] Order ${order.orderId} filled — position opened`);
    } else if (!cancelled) {
      surviving.push(order);
    }
  }

  saveOrders({ orders: surviving });
}
