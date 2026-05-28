import axios from 'axios';
import { env } from '../env.js';
import { Market, MarketOutcome } from '../types.js';

const clob = axios.create({ baseURL: env.polymarketClobUrl });
const gamma = axios.create({ baseURL: env.polymarketGammaUrl });

// ─── Gamma API: Market Discovery ─────────────────────────────────────────────

interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  tokens: Array<{ token_id: string; outcome: string }>;
  liquidityClob: number;
  volume24hrClob: number;
  endDate: string;
  active: boolean;
  closed: boolean;
}

export async function fetchNbaMarkets(): Promise<Market[]> {
  const res = await gamma.get<GammaMarket[]>('/markets', {
    params: {
      tag_slug: 'nba',
      active: true,
      closed: false,
      limit: 100,
    },
  });

  return res.data
    .filter(m => !m.closed && m.active)
    .map(m => ({
      marketId: m.id,
      conditionId: m.conditionId,
      question: m.question,
      outcomes: m.tokens.map(t => ({
        tokenId: t.token_id,
        outcome: t.outcome,
        price: 0, // will be filled by fetchPrices
      })),
      liquidity: m.liquidityClob ?? 0,
      volume24h: m.volume24hrClob ?? 0,
      closeTime: new Date(m.endDate).getTime() / 1000,
      active: m.active,
    }));
}

// ─── CLOB API: Live Prices ────────────────────────────────────────────────────

interface ClobPrice {
  token_id: string;
  price: string;
}

export async function fetchPrices(tokenIds: string[]): Promise<Map<string, number>> {
  if (tokenIds.length === 0) return new Map();

  const res = await clob.get<ClobPrice[]>('/prices', {
    params: { token_ids: tokenIds.join(',') },
  });

  const map = new Map<string, number>();
  for (const p of res.data) {
    map.set(p.token_id, parseFloat(p.price));
  }
  return map;
}

export async function fetchMarketsWithPrices(): Promise<Market[]> {
  const markets = await fetchNbaMarkets();
  const tokenIds = markets.flatMap(m => m.outcomes.map(o => o.tokenId));
  const prices = await fetchPrices(tokenIds);

  return markets.map(m => ({
    ...m,
    outcomes: m.outcomes.map(o => ({
      ...o,
      price: prices.get(o.tokenId) ?? o.price,
    })),
  }));
}

// ─── CLOB API: Order Book ─────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number;
  bestAsk: number;
  midpoint: number;
}

export async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
  const res = await clob.get<{ bids: Array<{price: string; size: string}>; asks: Array<{price: string; size: string}> }>(
    `/book`, { params: { token_id: tokenId } }
  );

  const bids = res.data.bids.map(b => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
  const asks = res.data.asks.map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) }));
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 1;

  return {
    tokenId,
    bids,
    asks,
    bestBid,
    bestAsk,
    midpoint: (bestBid + bestAsk) / 2,
  };
}
