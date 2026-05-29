# AGENTS.md — NBA Oracle Bot

Guidance for AI coding agents working in this repo.

## Project Overview

Autonomous trading bot for Polymarket NBA prediction markets. TypeScript monorepo, Node.js 20+.

- **Signal engines:** `src/agents/` — injury scout, cross-market arb, series EV (v2)
- **Data layer:** `src/data/` — Polymarket CLOB REST + WebSocket, ESPN, Odds API
- **Execution:** `src/execution/` — Kelly sizing, order manager, arb executor, exit manager, resolver
- **Risk:** `src/risk/` — kill switch, drawdown, correlation guard, exposure limits
- **Portfolio:** `src/portfolio/` — position tracker (persisted to `.canon/positions.json`)
- **Utils:** `src/utils/` — alerts (Discord/Telegram), config hot-reload watcher, retry, logger
- **Backtest:** `src/backtest/` — historical replay runner
- **CLI:** `src/cli/admin.ts` — operational commands

## Commands

```bash
npm run build          # tsc compile
npm run dev            # ts-node watch
npm start              # run bot (dry-run by default)
npm run backtest       # backtesting mode
npm run admin status   # admin CLI
npx vitest run         # run all tests (must stay green)
npx tsc --noEmit       # type check (must be clean)
```

## Key Rules

1. **Tests must stay green.** Run `npx vitest run` after every change. 144 tests currently passing.
2. **TypeScript must be clean.** Run `npx tsc --noEmit` before committing.
3. **Never commit `.env`.** Use `.env.example` for new vars.
4. **Never push `.github/workflows/`.** The GitHub token lacks `workflow` scope — git will reject it.
5. **All new modules go in `src/`, tests in `__tests__/`.** Mirror the filename: `src/foo/bar.ts` → `__tests__/bar.test.ts`.
6. **State is persisted to `.canon/`.** Don't delete or restructure files there — other modules depend on the schema.

## Architecture Notes

- **SELL orders bypass risk checks** — they reduce exposure, not add it. See `src/execution/executor.ts`.
- **ARB legs execute sequentially**, not in parallel — so Leg B's risk check sees Leg A's committed exposure.
- **Kelly fraction is hot-reloadable** — reads from `getHotConfig()` in `src/utils/config-watcher.ts`, not `env.kellyFraction`.
- **Team names are normalized** via `resolveTeam()` in `src/data/teams.ts` — use this everywhere, never raw strings.
- **Position tracker is a singleton** (`src/portfolio/index.ts`) — all modules share the same instance.

## Environment Variables

See `.env.example` for all vars. Hot-reloadable at runtime (no restart needed):
- `STOP_LOSS_PCT`, `TAKE_PROFIT_PCT`, `KELLY_FRACTION`, `MIN_EV_THRESHOLD`, `MAX_POSITION_USDC`

Required for live mode only:
- `WALLET_PRIVATE_KEY`, `WALLET_ADDRESS`

Optional integrations:
- `ODDS_API_KEY` — blends bookmaker consensus into EV model
- `DISCORD_WEBHOOK_URL` / `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — trade alerts
