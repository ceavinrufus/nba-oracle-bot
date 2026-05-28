# Strategy Design Document

## Overview

The NBA Oracle Bot implements a multi-signal approach to NBA playoff prediction market trading. Rather than competing on a single model, we run three independent signal engines and combine their output through a unified decision layer.

## Signal Engine 1: Injury Scout

**Thesis:** NBA injury reports drop 30–60 minutes before tip-off. Most bots poll on fixed intervals and use stale data. A star player ruled OUT causes predictable market mispricing that resolves quickly once widely known.

**Implementation:** Monitor ESPN injury endpoints at 60-second intervals. Track status changes (ACTIVE → OUT = high urgency signal). Filter to star players only (by name keyword). Estimate price impact by severity.

**Edge type:** Speed-based opportunity (official hackathon theme 3)

## Signal Engine 2: Cross-Market Arb

**Thesis:** Polymarket runs many correlated markets simultaneously. Two types of inconsistency arise:
1. **Complementary mispricing:** YES price + NO price ≠ 1.0 (should by definition)
2. **Series/game inconsistency:** Series win probability mathematically constrains game win probability in elimination scenarios

**Implementation:** Scan all active NBA markets. Check complement sums. Cross-reference series markets vs game markets for same team.

**Edge type:** Arbitrage detection (official hackathon theme 1) + Cross-market analysis (theme 2)

## Signal Engine 3: Series Probability Engine

**Thesis:** Polymarket prices often lag behind statistical reality, especially early in a series. A model built from season win rate, recent form, home court advantage, and series lead can identify markets where EV > 8%.

**Model inputs:**
- Season win rate (50% weight)
- Last 10 game form (30% weight)
- Home court advantage (20% weight)
- Series lead momentum (3% per game lead)

**Position sizing:** Fractional Kelly criterion (10%) capped at $10 USDC

**Edge type:** Speed-based opportunity + cross-market analysis

## Risk Management

All trades pass through:
1. EV threshold filter (>8%)
2. Confidence filter (>45%)
3. Liquidity filter (>$1K market)
4. Volume filter (>$50K 24h)
5. Kelly sizing (10% fractional)
6. Absolute cap ($10 USDC)
7. Kill switch (instant halt)

## Canon Integration

The three signal engines run conceptually in parallel within Canon's multi-agent framework. Each maps to a Canon agent role defined in `dega-core.yaml`:
- `market_analyst` → fetches and filters markets
- `injury_scout` → monitors injury reports
- `series_engine` → runs EV model
- `arb_detector` → cross-market scanning
- `executor` → Kelly sizing + order submission
