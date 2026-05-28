# 🏀 NBA Oracle Bot

> Multi-signal NBA prediction market trading bot — built for the DEGA NBA Playoffs Prediction Market Hackathon.

## Strategy: The Multi-Signal Oracle

Three parallel intelligence engines, one Canon-orchestrated decision layer:

| Engine | What it does | Edge |
|---|---|---|
| 🚨 **Injury Scout** | Detects star player status changes before markets reprice | Speed-based opportunity |
| 🔗 **Cross-Market Arb** | Finds mathematical inconsistencies between correlated markets | Pure arbitrage |
| 📊 **Series Probability Engine** | Compares model win probabilities vs Polymarket implied prices | Statistical EV |

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm 10+, Canon CLI
pipx install canon-tui    # install Canon
pnpm install              # install deps
cp .env.example .env      # configure (no wallet needed for dry-run)

# Run modes
pnpm run scan             # scan for opportunities (no trades)
pnpm run dry-run          # simulate trades (no real money)
pnpm run live             # live trading (requires wallet + USDC)

# Canon TUI (recommended)
./canon.sh                # launches Canon workspace, then type /canon-start
```

## Architecture

```
src/
├── agents/
│   ├── injury-scout.ts       # Signal 1: real-time injury monitoring
│   ├── crossmarket-arb.ts    # Signal 2: complementary + series/game inconsistency
│   └── series-probability.ts # Signal 3: ESPN-powered Kelly EV model
├── data/
│   ├── polymarket.ts         # Polymarket CLOB + Gamma API
│   └── espn.ts               # ESPN NBA data (free, no key)
├── execution/
│   ├── kelly.ts              # Fractional Kelly position sizing
│   ├── signer.ts             # EIP-712 order signing (ethers.js v6)
│   ├── executor.ts           # Dry-run + live order submission
│   └── kill-switch.ts        # Emergency halt
├── monitor/
│   └── dashboard.ts          # Canon TUI state writer
└── main.ts                   # Orchestrator
```

## Risk Management

- Fractional Kelly sizing (10% default) — reduces variance
- Max bet cap ($10 USDC default)
- Minimum EV threshold (8%)
- Minimum confidence gate (45%)
- Liquidity filter ($1K minimum)
- Kill switch (set `KILL_SWITCH=true` in `.env`)

## Running Tests

```bash
pnpm test
```

## Canon Integration

This bot is built Canon-native:
- `dega-core.yaml` defines success criteria checked at every iteration
- `canon.sh` auto-detects your AI agent (Claude/Gemini/Codex)
- `.canon/state.json` feeds the live Canon TUI dashboard
- `.canon/execution/` stores all trade logs (JSONL)

## Tech Stack

TypeScript 5 · Node.js 22 · pnpm · Vitest · oxlint · ethers.js v6
Polymarket CLOB + Gamma APIs · ESPN NBA API · Polygon mainnet
