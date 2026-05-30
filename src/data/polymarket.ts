import axios from 'axios';
import { env } from '../env.js';
import { Market } from '../types.js';
import { polymarketLimiter } from './limiters.js';

const clob = axios.create({ baseURL: env.polymarketClobUrl });
const gamma = axios.create({ baseURL: env.polymarketGammaUrl });

// ─── Gamma API: Market Discovery ─────────────────────────────────────────────

interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  tokens?: Array<{ token_id: string; outcome: string }>; // legacy field
  outcomes?: string; // JSON string array e.g. '["Yes","No"]'
  clobTokenIds?: string; // JSON string array of token IDs
  liquidityClob?: number;
  liquidityNum?: number;
  volume24hrClob?: number;
  volumeNum?: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  outcomePrices?: string; // JSON array of price strings e.g. '["0.65","0.35"]'
}

interface GammaEvent {
  id: string;
  title: string;
  markets: GammaMarket[];
}

export async function fetchNbaMarkets(): Promise<Market[]> {
  try {
  await polymarketLimiter.throttle();

  // Use /events endpoint with tag=nba (tag_slug on /markets is unreliable)
  const eventsRes = await gamma.get<GammaEvent[]>('/events', {
    params: { tag: 'nba', active: true, limit: 100 },
  });
  polymarketLimiter.recordSuccess();

  // Also fetch a broad active market list and filter by NBA keywords client-side
  // (Polymarket's tag/keyword params are unreliable for current-season markets)
  await polymarketLimiter.throttle();
  const broadRes = await gamma.get<GammaMarket[]>('/markets', {
    params: { active: true, closed: false, limit: 500 },
  });
  polymarketLimiter.recordSuccess();

  const NBA_KEYWORDS = /nba|thunder|knicks|pacers|celtics|lakers|warriors|nuggets|suns|clippers|bucks|heat|nets|76ers|spurs|mavericks|grizzlies|timberwolves|pelicans|kings|jazz|rockets|magic|hornets|cavaliers|raptors|pistons|hawks|wizards|trail blazers|blazers|nba finals/i;

  // Flatten all markets from all events + broad keyword-filtered results
  const allMarkets: GammaMarket[] = [
    ...eventsRes.data.flatMap(e => e.markets ?? []),
    ...broadRes.data.filter(m => NBA_KEYWORDS.test(m.question)),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  const res = { data: allMarkets.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }) };

  return res.data
    .filter(m => !m.closed && m.active)
    .map(m => {
      const prices: number[] = m.outcomePrices
        ? (JSON.parse(m.outcomePrices) as string[]).map(Number)
        : [];

      // Support both legacy `tokens` field and new `outcomes`+`clobTokenIds` fields
      const outcomeNames: string[] = m.tokens
        ? m.tokens.map(t => t.outcome)
        : m.outcomes
        ? (JSON.parse(m.outcomes) as string[])
        : [];
      const tokenIds: string[] = m.tokens
        ? m.tokens.map(t => t.token_id)
        : m.clobTokenIds
        ? (JSON.parse(m.clobTokenIds) as string[])
        : [];

      return {
        marketId: m.id,
        conditionId: m.conditionId,
        question: m.question,
        outcomes: outcomeNames.map((name, i) => ({
          tokenId: tokenIds[i] ?? '',
          outcome: name,
          price: prices[i] ?? 0,
        })),
        liquidity: m.liquidityClob ?? m.liquidityNum ?? 0,
        volume24h: m.volume24hrClob ?? m.volumeNum ?? 0,
        closeTime: new Date(m.endDate).getTime() / 1000,
        active: m.active,
      };
    });
  } catch (err) {
    polymarketLimiter.recordFailure();
    throw err;
  }
}

// ─── CLOB API: Live Prices ────────────────────────────────────────────────────

interface ClobPrice {
  token_id: string;
  price: string;
}

export async function fetchPrices(tokenIds: string[]): Promise<Map<string, number>> {
  if (tokenIds.length === 0) return new Map();

  try {
    await polymarketLimiter.throttle();
    const res = await clob.get<ClobPrice[]>('/prices', {
      params: { token_ids: tokenIds.join(',') },
      paramsSerializer: { indexes: null },
    });
    polymarketLimiter.recordSuccess();

    const map = new Map<string, number>();
    for (const p of res.data) {
      map.set(p.token_id, parseFloat(p.price));
    }
    return map;
  } catch {
    polymarketLimiter.recordFailure();
    // Fallback: prices already populated from Gamma outcomePrices
    return new Map();
  }
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

// ─── CLOB API: Market Resolution ─────────────────────────────────────────────

export interface MarketResolution {
  conditionId: string;
  resolved: boolean;
  winnerTokenId: string | null;
  resolvedAt: number | null;
}

export async function fetchMarketResolution(conditionId: string): Promise<MarketResolution> {
  try {
    await polymarketLimiter.throttle();
    const res = await clob.get(`/markets/${conditionId}`);
    polymarketLimiter.recordSuccess();
    const data = res.data;
    const resolved = data.closed === true || data.resolved === true;
    let winnerTokenId: string | null = null;
    if (resolved && data.tokens) {
      const winner = data.tokens.find((t: { price: number }) => t.price >= 0.99);
      winnerTokenId = winner?.token_id ?? null;
    }
    return { conditionId, resolved, winnerTokenId, resolvedAt: resolved ? Date.now() : null };
  } catch {
    return { conditionId, resolved: false, winnerTokenId: null, resolvedAt: null };
  }
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
