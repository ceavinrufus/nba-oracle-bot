# NBA Oracle Bot — Full Version Implementation Plan

**Goal:** Evolve the MVP into a production-grade autonomous trading system for Polymarket NBA prediction markets, with real-time price feeds, full order lifecycle management, backtesting, alerting, and a CLI control surface.

**Architecture:** TypeScript monorepo. All new modules live under `src/`. Tests live under `__tests__/`. Config via `.env`. State persisted to `.canon/`.

**Tech Stack:**
- Runtime: Node.js 20+ / TypeScript 5
- HTTP: axios (existing)
- WebSocket: `ws` package (add to deps)
- Testing: vitest (existing)
- CLI: commander (existing)
- Alerts: node-telegram-bot-api OR Discord.js webhook client
- Odds API: The Odds API (https://the-odds-api.com) for betting line data
- Scheduler: setInterval / node-cron for hot-reload

---

## Task 1 — Real-Time WebSocket Price Feeds

**Objective:** Replace periodic REST polling with a persistent WebSocket subscription so price moves are detected sub-second instead of every 30s.

**Files:**
- `src/data/polymarket-ws.ts` — already scaffolded; complete integration
- `src/main.ts` — replace `fetchMarketsWithPrices` polling with ws push

**Steps:**
1. Add `ws` package: `npm install ws @types/ws`
2. In `polymarket-ws.ts`, implement `PolymarketWebSocket.subscribe(tokenIds: string[])`:
   - Connect to `wss://ws-subscriptions-clob.polymarket.com/ws/market`
   - Send subscription frame: `{ type: "subscribe", channel: "price_change", assets_ids: tokenIds }`
   - On message, update `priceCache` and emit `pricemove` event if delta > `PRICE_MOVE_THRESHOLD`
3. Implement reconnect with exponential backoff (`BASE_RECONNECT_DELAY_MS` → `MAX_RECONNECT_DELAY_MS`)
4. In `main.ts`, instantiate `PolymarketWebSocket` at startup, subscribe to all tracked market tokenIds
5. In `runCycle`, read prices from `ws.getPrice(tokenId)` if available; fall back to REST on cache miss
6. Add `ws.on('pricemove', ...)` handler that triggers an immediate mini-cycle for the affected market

**Verification:**
- `npx vitest run __tests__/polymarket-ws.test.ts` (7 existing tests must still pass)
- Add integration smoke test: mock server, verify reconnect fires after close event
- Confirm REST polling interval can be raised to 5 min with ws active

---

## Task 2 — Live Order Management (Track, Cancel Stale, Retry)

**Objective:** After a live order is placed and returns `pending`, poll the CLOB for fill status and handle stale orders gracefully.

**Files:**
- `src/execution/order-manager.ts` — new
- `src/execution/executor.ts` — call order-manager on `pending` result
- `src/portfolio/tracker.ts` — expose `markFilled(tokenId)` helper

**Steps:**
1. Create `src/execution/order-manager.ts`:
   ```typescript
   interface PendingOrder { orderId: string; tokenId: string; decision: TradeDecision; placedAt: number; }
   ```
   - `trackOrder(order: PendingOrder)` — adds to in-memory queue
   - `pollOrders()` — for each pending order: `GET /order/{id}`, check status
     - If `matched` → call `tracker.addPosition(...)`, remove from queue
     - If `canceled` or age > 5 min → log, remove from queue
     - If still `pending` and age > 2 min → cancel via `DELETE /order/{id}`, log stale cancel
2. In `executor.ts`, when result is `pending`, call `orderManager.trackOrder(...)`
3. In `main.ts` live loop, call `orderManager.pollOrders()` at the top of each cycle
4. Expose `getOpenOrders()` from order-manager for CLI Task 12

**Verification:**
- Unit test: mock CLOB responses, verify fill/stale/cancel paths
- Integration: place a dry-run order, simulate pending → filled transition

---

## Task 3 — Position Closing Logic & P&L Calculation

**Objective:** Detect when markets resolve, close positions, and record accurate P&L.

**Files:**
- `src/execution/resolver.ts` — new
- `src/data/polymarket.ts` — add `fetchMarketResolution(marketId)`
- `src/portfolio/tracker.ts` — `closePosition` already exists; wire it up

**Steps:**
1. In `polymarket.ts`, add:
   ```typescript
   export async function fetchMarketResolution(marketId: string): Promise<number | null>
   ```
   - `GET /markets/{marketId}` → if `is_resolved: true` return `outcome_price` (1.0 or 0.0); else `null`
2. Create `src/execution/resolver.ts`:
   - `resolvePositions()` — iterate open positions, call `fetchMarketResolution(market)`:
     - If resolved: `tracker.closePosition(tokenId, resolvedPrice)` → logs P&L
     - If not: skip
3. In `main.ts` live loop, call `resolvePositions()` once per cycle
4. In `dashboard.ts`, update `pnl_usdc` from `tracker.getClosedPositions()` P&L sum
5. Add `pnlSummary()` to `src/portfolio/pnl.ts` returning total, realized, unrealized breakdowns

**Verification:**
- Unit test: mock resolved market → verify position closed with correct P&L math
- Test 0.0 resolution (loss) and 1.0 resolution (win) paths

---

## Task 4 — Better Market Matching (Team Name Normalization)

**Objective:** Replace fragile substring matching with robust team name normalization so `"Oklahoma City Thunder"`, `"OKC"`, `"Thunder"`, and `"okc thunder"` all resolve to the same canonical key.

**Files:**
- `src/data/teams.ts` — new: canonical team registry
- `src/agents/series-probability-v2.ts` — use canonical matching
- `src/agents/crossmarket-arb.ts` — use canonical matching
- `src/risk/correlation.ts` — use canonical team ID

**Steps:**
1. Create `src/data/teams.ts`:
   ```typescript
   interface TeamEntry { id: string; fullName: string; aliases: string[]; }
   const NBA_TEAMS: TeamEntry[] = [ /* all 30 teams with common abbreviations */ ]
   export function resolveTeam(text: string): string | null  // returns canonical id or null
   ```
2. Implement `resolveTeam`:
   - Lowercase + strip punctuation
   - Exact match → return id
   - Partial/alias match → return id
   - No match → return `null`
3. In `series-probability-v2.ts`, replace:
   ```typescript
   const isHome = outcomeLower.includes(series.homeTeam.teamName.toLowerCase());
   ```
   with:
   ```typescript
   const outcomeTeam = resolveTeam(outcome.outcome);
   const homeTeam = resolveTeam(series.homeTeam.teamName);
   const isHome = outcomeTeam !== null && outcomeTeam === homeTeam;
   ```
4. Apply same pattern in `crossmarket-arb.ts` series/game matching
5. Update `correlation.ts` to use canonical team IDs for correlation checks

**Verification:**
- Unit test `resolveTeam` with full names, abbreviations, and garbage input
- Test that "OKC" and "Oklahoma City Thunder" both resolve to `'okc-thunder'`

---

## Task 5 — Backtesting Mode

**Objective:** Replay historical market price snapshots to validate signal quality (hit rate, Kelly EV accuracy) before committing real capital.

**Files:**
- `src/backtest/runner.ts` — new
- `src/backtest/data-loader.ts` — new
- `src/backtest/report.ts` — new
- `src/main.ts` — add `--mode backtest` flag

**Steps:**
1. Create `src/backtest/data-loader.ts`:
   - `loadHistoricalMarkets(dir: string): Market[][]` — reads JSONL snapshots from a directory
   - Each line = one market snapshot batch with timestamp
2. Create `src/backtest/runner.ts`:
   - `runBacktest(snapshotDir, injuryFile)`:
     - Replay each snapshot through `scanSeriesEVv2` and `scanCrossMarketArb`
     - For each signal, simulate a trade at signal price
     - At market resolution, score win/loss and compute realized EV vs modeled EV
3. Create `src/backtest/report.ts`:
   - Output: signal count, trades taken, win rate, avg EV, Kelly accuracy, total simulated P&L
   - Write to `reports/backtest-{timestamp}.json`
4. In `main.ts`, add `--mode backtest --data <dir>` option that calls `runBacktest()`

**Verification:**
- Generate 3 synthetic snapshot files covering a 7-game series, run backtest
- Confirm report JSON is written with correct win/loss counts

---

## Task 6 — Alert System (Telegram / Discord)

**Objective:** Push real-time notifications on high-urgency signals, executed trades, and kill switch events.

**Files:**
- `src/alerts/notifier.ts` — new
- `src/alerts/telegram.ts` — new (optional)
- `src/alerts/discord.ts` — new (optional)
- `src/main.ts` — call notifier on key events
- `.env.example` — document new vars

**Steps:**
1. Create `src/alerts/notifier.ts`:
   ```typescript
   export interface AlertEvent { level: 'INFO' | 'WARN' | 'CRITICAL'; message: string; data?: unknown; }
   export async function alert(event: AlertEvent): Promise<void>
   ```
   - Reads `ALERT_CHANNEL` env var: `'telegram'` | `'discord'` | `'none'`
   - Dispatches to the relevant implementation
2. Create `src/alerts/discord.ts`:
   - Uses `DISCORD_WEBHOOK_URL` env var
   - Posts embed with level color, message, and data snippet
3. Create `src/alerts/telegram.ts` (optional parallel impl):
   - Uses `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
4. Wire into `main.ts`:
   - `alert({ level: 'WARN', message: '🚨 INJURY: ...' })` for HIGH urgency injuries
   - `alert({ level: 'INFO', message: '✅ Trade executed: ...' })` after fill
   - `alert({ level: 'CRITICAL', message: '🛑 Kill switch triggered' })` in drawdown
5. Add `ALERT_CHANNEL`, `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` to `.env.example`

**Verification:**
- Mock the HTTP webhook call, verify correct embed format
- Test that `ALERT_CHANNEL=none` is a no-op (no HTTP calls)

---

## Task 7 — SELL Signal Logic (Early Exit)

**Objective:** Exit positions early if the market price moves adversely past a stop-loss threshold.

**Files:**
- `src/execution/exit-manager.ts` — new
- `src/execution/executor.ts` — handle `SELL` side
- `src/main.ts` — call `checkExits()` each cycle

**Steps:**
1. Create `src/execution/exit-manager.ts`:
   - `checkExits(currentMarkets: Market[])`:
     - Iterate open positions
     - Find current market price for each `tokenId`
     - If current price < `entryPrice * (1 - STOP_LOSS_THRESHOLD)` → emit sell signal
     - STOP_LOSS_THRESHOLD default: 0.30 (30% adverse move); configurable via env
2. In `exit-manager.ts`, `generateSellDecision(pos, currentPrice) → TradeDecision`:
   - `side: 'SELL'`, `price: currentPrice`, `reasoning: 'Stop-loss exit'`
3. In `executor.ts`, handle `SELL` side:
   - Same CLOB `/order` endpoint but with `side: 'SELL'`
   - On fill: call `tracker.closePosition(tokenId, fillPrice)` → records P&L
4. In `main.ts` `runCycle()`, call `checkExits(markets)` before scanning for new signals

**Verification:**
- Unit test: position entered at 0.6, current price 0.3 → generates SELL
- Test that price at 0.45 (25% drop, below 30% threshold) does NOT generate SELL

---

## Task 8 — True Arbitrage Execution (Both Legs)

**Objective:** When an ARB signal is detected, execute both legs atomically to lock in risk-free profit.

**Files:**
- `src/execution/arb-executor.ts` — new
- `src/agents/crossmarket-arb.ts` — expose leg details for execution
- `src/main.ts` — route ARB signals to `arbExecutor`

**Steps:**
1. In `crossmarket-arb.ts`, ensure `ArbSignal.marketB` always has a valid `tokenId` for the second leg (audit existing `detectComplementaryArb` — `marketB.tokenId` already set; verify `detectSeriesGameInconsistency` too)
2. Create `src/execution/arb-executor.ts`:
   - `executeArb(signal: ArbSignal, sizeUsdc: number)`:
     - Build two `TradeDecision` objects (leg A and leg B)
     - Call `execute(legA)` → if filled, immediately call `execute(legB)`
     - If legA fills but legB rejects, call `exit-manager` to reverse legA
     - Log both outcomes atomically
3. In `main.ts`, in `signalToDecision`: instead of returning a single decision for ARB, call `executeArb` directly (bypassing the single-decision path)
4. Add `maxArbSpreadUsdc` env var (default: $5) to cap each arb leg

**Verification:**
- Unit test: mock both legs fill → verify both positions added to tracker
- Unit test: legA fills, legB rejects → verify legA reversal triggered

---

## Task 9 — Enhanced EV Model (Betting Lines + Fatigue)

**Objective:** Incorporate real-world betting line data, referee tendencies, and travel fatigue into `computeSeriesProbabilityV2`.

**Files:**
- `src/data/odds-api.ts` — new
- `src/data/schedule.ts` — new (travel/rest calculation)
- `src/agents/series-probability-v2.ts` — extend model inputs

**Steps:**
1. Create `src/data/odds-api.ts`:
   - `fetchNbaOdds() → { teamA: string; teamB: string; moneylineA: number; moneylineB: number }[]`
   - Uses The Odds API: `GET https://api.the-odds-api.com/v4/sports/basketball_nba/odds`
   - Convert American odds to implied probability
   - Add `ODDS_API_KEY` to `.env.example`
2. Create `src/data/schedule.ts`:
   - `fetchTeamSchedule(teamId: string) → GameEntry[]`
   - `computeTravelFatigue(schedule: GameEntry[], gameDate: Date) → number` (0–1, higher = more fatigued)
   - Logic: games in last 3 days + distance from last venue
3. In `series-probability-v2.ts`, extend `SeriesProbabilityOptions`:
   ```typescript
   bettingLineProb?: number;   // from odds API, 0-1
   travelFatigue?: number;     // 0-1
   ```
4. In `computeSeriesProbabilityV2`:
   - Add betting line blend: `if (bettingLineProb) rawProb = 0.7 * rawProb + 0.3 * bettingLineProb`
   - Add travel fatigue: `rawProb -= travelFatigue * 0.05`
5. In `scanSeriesEVv2`, enrich options with odds + fatigue data per series

**Verification:**
- Unit test: with betting line at 0.7 vs model 0.5 → blended result is 0.56
- Test fatigue adjustment clamps correctly within [0.05, 0.95]

---

## Task 10 — Rate Limiting + Circuit Breakers Everywhere

**Objective:** Apply `withRetry` from `src/utils/retry.ts` consistently across all external API calls; add per-API rate limiters.

**Files:**
- `src/utils/rate-limiter.ts` — new
- `src/data/espn.ts` — wrap all calls
- `src/data/polymarket.ts` — wrap all calls
- `src/data/odds-api.ts` — wrap all calls
- `src/utils/retry.ts` — add jitter to backoff

**Steps:**
1. Create `src/utils/rate-limiter.ts`:
   ```typescript
   export class RateLimiter {
     constructor(requestsPerSecond: number) {}
     async throttle(): Promise<void>  // waits if needed
   }
   ```
   - Token bucket algorithm, one limiter instance per API
2. In `retry.ts`, add jitter to exponential backoff:
   ```typescript
   const jitter = Math.random() * delay * 0.3;
   await sleep(delay + jitter);
   ```
3. Create shared limiters in `src/data/limiters.ts`:
   ```typescript
   export const espnLimiter = new RateLimiter(2);     // 2 req/s
   export const polymarketLimiter = new RateLimiter(5); // 5 req/s
   export const oddsLimiter = new RateLimiter(0.5);   // 1 req/2s (free tier)
   ```
4. Wrap every `espn.get(...)` with `await espnLimiter.throttle()` before the call
5. Wrap every `polymarket` API call similarly
6. Add circuit-breaker flag: after 5 consecutive failures from one API, back off for 60s

**Verification:**
- Unit test rate-limiter: fire 10 requests in 1s, verify only 2 proceed immediately
- Unit test jitter: 100 samples, verify none have identical delay

---

## Task 11 — Config Hot-Reload

**Objective:** Allow updating risk parameters (EV threshold, Kelly fraction, max bet) without restarting the bot.

**Files:**
- `src/config/hot-reload.ts` — new
- `src/env.ts` — expose mutable config snapshot
- `.canon/config.json` — watched file

**Steps:**
1. Move runtime-mutable params out of `env` const into a separate `riskConfig` object:
   ```typescript
   export const riskConfig = {
     minEvThreshold: env.minEvThreshold,
     kellyFraction: env.kellyFraction,
     maxBetUsdc: env.maxBetUsdc,
     minConfidence: env.minConfidence,
   };
   ```
2. Create `src/config/hot-reload.ts`:
   - Uses `fs.watch('.canon/config.json', ...)` 
   - On change: parse JSON, validate schema, merge into `riskConfig`
   - Log `[CONFIG] Reloaded: minEvThreshold=0.10`
3. Update all consumers (`kelly.ts`, `series-probability-v2.ts`, etc.) to read from `riskConfig` instead of `env`
4. In `main.ts`, call `startHotReload()` at startup
5. Document `.canon/config.json` schema in README

**Verification:**
- Integration test: write `.canon/config.json` with new `maxBetUsdc`, verify next `kellySize` call respects it
- Test that malformed JSON logs error without crashing

---

## Task 12 — Admin CLI

**Objective:** Provide a local CLI for operators to inspect state and control the bot without restarting.

**Files:**
- `src/cli/admin.ts` — new entry point
- `package.json` — add `"admin": "tsx src/cli/admin.ts"` script

**Steps:**
1. Create `src/cli/admin.ts` using `commander`:
   - `status` — print `CanonState` from `.canon/state.json` as formatted table
   - `positions` — print open positions from `.canon/positions.json`
   - `pnl` — print P&L summary (realized + unrealized)
   - `pause` — write `TRADING_MODE=scan` to `.canon/config.json` (hot-reload picks it up)
   - `resume` — write `TRADING_MODE=dry-run` or `live` to `.canon/config.json`
   - `close-all` — set kill switch flag, then send SELL for each open position
   - `logs [--tail N]` — tail last N lines from `.canon/execution/` JSONL log
2. Each command reads state from filesystem (no IPC needed — shared `.canon/` dir)
3. `close-all` calls `exit-manager.checkExits()` with price=0 to force-close all positions
4. Add colored output with `chalk` or similar

**Verification:**
- `node dist/cli/admin.js status` should print state without crashing on empty dir
- `node dist/cli/admin.js pause` → read `.canon/config.json`, verify `TRADING_MODE=scan`
- Test `pnl` with a mix of open and closed positions from fixture file

---

## Sequencing & Dependencies

```
Task 1 (WebSocket)          → no deps
Task 4 (Team Normalization) → no deps (but improves Tasks 2, 7, 8)
Task 10 (Rate Limiting)     → no deps
Task 2 (Order Manager)      → needs Task 1 (prices for fill detection)
Task 3 (Resolver / P&L)     → needs Task 2
Task 7 (SELL / Exit)        → needs Task 3 (P&L tracking)
Task 8 (True Arb Exec)      → needs Task 2 + Task 7
Task 5 (Backtesting)        → needs Task 4
Task 9 (Enhanced EV)        → needs Task 4 + Task 10
Task 11 (Hot-Reload)        → needs Tasks 1-3 done first (stable core)
Task 6 (Alerts)             → can be added at any time after Task 2
Task 12 (Admin CLI)         → needs Tasks 2, 3, 11
```

**Recommended sprint order:**
1. Task 4 (team normalization) — 1 day
2. Task 10 (rate limiting) — 1 day
3. Task 1 (WebSocket) — 2 days
4. Task 2 (order manager) + Task 3 (resolver) — 2 days
5. Task 7 (exit/SELL) — 1 day
6. Task 6 (alerts) — 1 day
7. Task 8 (true arb) — 2 days
8. Task 5 (backtest) — 2 days
9. Task 9 (enhanced EV) — 2 days
10. Task 11 (hot-reload) — 1 day
11. Task 12 (admin CLI) — 1 day

**Total estimated effort: ~16 developer-days**

---

## Environment Variables Added by Full Version

```bash
# Alerts
ALERT_CHANNEL=discord           # discord | telegram | none
DISCORD_WEBHOOK_URL=https://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Odds API
ODDS_API_KEY=...

# Exit manager
STOP_LOSS_THRESHOLD=0.30        # 30% adverse move triggers stop-loss

# Arb execution
MAX_ARB_SPREAD_USDC=5

# Order management
ORDER_POLL_INTERVAL_MS=15000    # how often to poll pending orders
ORDER_STALE_AGE_MS=120000       # cancel after 2 min if still pending
```
