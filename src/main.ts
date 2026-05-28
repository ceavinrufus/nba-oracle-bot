import { Command } from 'commander';
import { env, getMode, validateEnv } from './env.js';
import { dashboard } from './monitor/dashboard.js';
import { logger } from './utils/logger.js';
import { withRetry } from './utils/retry.js';
import { isKilled } from './execution/kill-switch.js';

import { scanInjuries } from './agents/injury-scout.js';
import { scanCrossMarketArb } from './agents/crossmarket-arb.js';
import { scanSeriesEVv2 } from './agents/series-probability-v2.js';

import { fetchMarketsWithPrices } from './data/polymarket.js';
import { fetchUsdcBalance } from './data/chain.js';
import { PolymarketWebSocket } from './data/polymarket-ws.js';
import { kellySize } from './execution/kelly.js';
import { execute } from './execution/executor.js';

import { Signal, TradeDecision } from './types.js';
import { tracker } from './portfolio/index.js';
import { resolveTeam } from './data/teams.js';

const program = new Command();
program
  .option('--mode <mode>', 'Trading mode: scan | dry-run | live', env.tradingMode)
  .parse();

const opts = program.opts<{ mode: string }>();
if (opts.mode) process.env['TRADING_MODE'] = opts.mode;

// ─── Position Deduplication ───────────────────────────────────────────────────

const RECENT_TRADE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const recentTrades = new Map<string, number>(); // tokenId → timestamp

function markTraded(tokenId: string): void {
  recentTrades.set(tokenId, Date.now());
}

function wasRecentlyTraded(tokenId: string): boolean {
  const ts = recentTrades.get(tokenId);
  if (!ts) return false;
  if (Date.now() - ts > RECENT_TRADE_TTL_MS) {
    recentTrades.delete(tokenId);
    return false;
  }
  return true;
}

// ─── Signal → Decision ────────────────────────────────────────────────────────

function signalToDecision(signal: Signal, bankrollUsdc: number): TradeDecision | null {
  if (signal.type === 'INJURY') {
    // Injury signals don't directly map to a trade without price data
    // Log them for awareness; they inform the EV signals indirectly
    return null;
  }

  if (signal.type === 'ARB') {
    // marketA.price is the current market price; actualProb is the model's fair value
    const size = kellySize(signal.actualProb, signal.marketA.price, bankrollUsdc);
    if (size < 0.5) return null;
    return {
      signal,
      tokenId: signal.marketA.tokenId,
      team: resolveTeam(signal.marketA.outcome) ?? undefined,
      side: 'BUY',
      price: signal.marketA.price,
      sizeUsdc: size,
      reasoning: signal.description,
    };
  }

  if (signal.type === 'EV') {
    const size = kellySize(signal.modelProbability, signal.impliedProbability, bankrollUsdc);
    if (size < 0.5) return null;
    return {
      signal,
      tokenId: signal.outcome.tokenId,
      team: resolveTeam(signal.outcome.outcome) ?? undefined,
      side: 'BUY',
      price: signal.impliedProbability,
      sizeUsdc: size,
      reasoning: `EV=${(signal.ev * 100).toFixed(1)}% model=${(signal.modelProbability * 100).toFixed(1)}% implied=${(signal.impliedProbability * 100).toFixed(1)}%`,
    };
  }

  return null;
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function runCycle(bankrollUsdc: number, liveprices: Map<string, number>): Promise<void> {
  dashboard.setPhase('scanning', 'Fetching markets and signals...');
  dashboard.recordScan();

  // Run all three signal engines in parallel
  const [markets, injurySignals] = await Promise.all([
    withRetry(() => fetchMarketsWithPrices()).catch(e => {
      logger.error('Failed to fetch markets', e);
      return [];
    }),
    withRetry(() => scanInjuries()).catch(e => {
      logger.error('Injury scout failed', e);
      return [];
    }),
  ]);

  dashboard.setSignalStatus('injury_scout', injurySignals.length > 0 ? 'signal_found' : 'idle');

  // Overlay WebSocket live prices onto freshly fetched markets
  for (const market of markets) {
    for (const outcome of (market as { outcomes: Array<{ tokenId: string; price: number }> }).outcomes) {
      const lp = liveprices.get(outcome.tokenId);
      if (lp !== undefined) outcome.price = lp;
    }
  }

  if (injurySignals.length > 0) {
    for (const s of injurySignals) {
      dashboard.addLog(`🚨 INJURY: ${s.injury.playerName} → ${s.injury.status} (${s.urgency})`);
      logger.info('Injury signal detected', { signal: s });
    }
  }

  const [arbSignals, evSignals] = await Promise.all([
    scanCrossMarketArb(markets).catch(e => {
      logger.error('Arb scanner failed', e);
      return [];
    }),
    scanSeriesEVv2(markets, injurySignals.map(s => s.injury)).catch(e => {
      logger.error('EV scanner failed', e);
      return [];
    }),
  ]);

  dashboard.setSignalStatus('crossmarket_arb', arbSignals.length > 0 ? 'signal_found' : 'idle');
  dashboard.setSignalStatus('series_probability', evSignals.length > 0 ? 'signal_found' : 'idle');

  const allSignals: Signal[] = [...injurySignals, ...arbSignals, ...evSignals];

  if (allSignals.length === 0) {
    dashboard.setPhase('idle', 'No opportunities found. Waiting...');
    return;
  }

  dashboard.recordOpportunity();
  dashboard.setPhase('analyzing', `Found ${allSignals.length} signal(s). Evaluating...`);

  // Convert to trade decisions (filter out recently traded positions)
  const decisions = allSignals
    .map(s => signalToDecision(s, bankrollUsdc))
    .filter((d): d is TradeDecision => d !== null)
    .filter(d => !wasRecentlyTraded(d.tokenId))
    .filter(d => !tracker.hasPosition(d.tokenId));

  if (decisions.length === 0) {
    dashboard.setPhase('idle', 'Signals found but no trades pass filters.');
    return;
  }

  dashboard.setPhase('executing', `Executing ${decisions.length} trade(s)...`);

  for (const decision of decisions) {
    if (isKilled()) break;
    const result = await execute(decision);
    if (result.status === 'filled' || result.status === 'simulated') {
      markTraded(decision.tokenId);
      dashboard.recordTrade(0); // PnL unknown until settlement
      dashboard.addLog(`✅ ${decision.side} ${decision.sizeUsdc.toFixed(2)} USDC — ${decision.reasoning}`);
    }
  }

  dashboard.setPhase('idle', `Cycle complete. Waiting ${env.marketPollMs / 1000}s...`);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();
  const mode = getMode();
  console.log(`\n🏀 NBA Oracle Bot — ${mode.toUpperCase()} MODE`);
  console.log(`Strategy: Injury Scout + Cross-Market Arb + Series EV`);
  console.log(`Min EV: ${(env.minEvThreshold * 100).toFixed(0)}% | Kelly: ${(env.kellyFraction * 100).toFixed(0)}% | Max bet: $${env.maxBetUsdc}\n`);

  dashboard.setPhase('scanning', `${mode.toUpperCase()} mode started`);
  logger.info(`NBA Oracle Bot started`, { mode, version: '0.1.0' });

  const BANKROLL = mode === 'live' && env.walletAddress
    ? await fetchUsdcBalance(env.walletAddress).catch(() => 100)
    : 100;

  // ─── WebSocket Price Feeds ─────────────────────────────────────────────────
  const liveprices = new Map<string, number>();
  const wsClient = new PolymarketWebSocket(
    (url: string) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const WS = require('ws') as { new(url: string): any };
      return new WS(url) as import('./data/polymarket-ws.js').WebSocketLike;
    },
  );

  // Pre-fetch markets to seed token IDs for WS subscription
  const seedMarkets = await fetchMarketsWithPrices().catch(() => []);
  const allTokenIds = seedMarkets.flatMap(
    (m: { outcomes: Array<{ tokenId: string }> }) => m.outcomes.map(o => o.tokenId)
  );
  if (allTokenIds.length > 0) {
    wsClient.trackTokens(allTokenIds);
    wsClient.connect();
  }

  wsClient.on('priceMove', ({ tokenId, newPrice }: { tokenId: string; newPrice: number }) => {
    liveprices.set(tokenId, newPrice);
  });

  // Run once (scan/dry-run) or loop (live)
  if (mode === 'scan' || mode === 'dry-run') {
    await runCycle(BANKROLL, liveprices);
    wsClient.disconnect();
    console.log('\n✅ Cycle complete. Check .canon/execution/ for logs.');
  } else {
    // Live: continuous loop
    while (!isKilled()) {
      try {
        await runCycle(BANKROLL, liveprices);
      } catch (err) {
        logger.error('Cycle failed', err);
        dashboard.setPhase('error', `Cycle error: ${err instanceof Error ? err.message : String(err)}`);
      }
      await new Promise(r => setTimeout(r, env.marketPollMs));
    }
    wsClient.disconnect();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
