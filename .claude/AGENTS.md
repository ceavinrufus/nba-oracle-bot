# NBA Oracle Bot — Agent Context

## Project Overview
Multi-signal NBA prediction market trading bot for DEGA hackathon.
Strategy: Injury Scout + Cross-Market Arb + Series Probability Engine.
Deadline: May 31, 2026.

## Quick Start
```bash
pnpm install
cp .env.example .env
pnpm run dry-run      # test without real money
./canon.sh            # launch Canon TUI
```

## Architecture
- `src/agents/` — Three signal engines (run conceptually in parallel)
- `src/data/` — Polymarket + ESPN API clients
- `src/execution/` — Kelly sizing + EIP-712 order submission
- `src/monitor/` — Canon TUI state writer
- `.canon/state.json` — Live dashboard state (read by Canon TUI)
- `.canon/execution/` — JSONL trade logs (required for submission)

## Key APIs
- Polymarket CLOB: `https://clob.polymarket.com`
- Polymarket Gamma: `https://gamma-api.polymarket.com`  
- ESPN NBA: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba`
- Polygon mainnet (chainId 137)

## Constraints
- Max bet: $10 USDC (configurable via MAX_BET_USDC)
- Kelly fraction: 10% by default (conservative)
- Only trade when EV > 8% AND confidence > 45%
- Kill switch: set KILL_SWITCH=true in .env to halt immediately

## Running Tests
```bash
pnpm test
```
