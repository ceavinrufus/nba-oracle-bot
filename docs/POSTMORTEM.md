# Post-Mortem: NBA Oracle Bot vs Arbiter

**Hackathon:** DEGA NBA Playoffs Prediction Market Hackathon
**Result:** Did not win. Arbiter ([ismailridwans/arbiter](https://github.com/ismailridwans/arbiter)) took the prize.
**Date:** 2026-06

This is an honest accounting of why we lost. The goal is to make the next one different, not to feel better.

---

## TL;DR

We built more software. They built a better story around less software. On a hackathon rubric, story wins.

Their thesis — *"don't predict outcomes, enforce the math the market forgot"* — is a defensible quant-desk product. Ours — *"three signal engines vote"* — is a competent hackathon project. We had **3.4× the tests** and more signals, and it didn't matter.

---

## The honest comparison

|  | Arbiter (winner) | NBA Oracle Bot (us) |
|---|---|---|
| **Core thesis** | Market-neutral coherence arbitrage — never predicts a winner | Multi-signal alpha (injury + arb + EV) |
| **Edge type** | Pure structural (logical violations + cross-venue) | Mixed: 1 arb signal, 2 directional |
| **Venues** | Polymarket **+ Kalshi** (fee-aware cross-venue) | Polymarket only |
| **Live hosted demo** | ✅ Vercel — judges click and see it | ❌ CLI bot, nothing to click |
| **Demo video** | ✅ 3 min | ✅ 3 min |
| **Tests** | 42 vitest (core math 100%) | 144 vitest |
| **Backtest** | ✅ Real `/prices-history` + cost-sensitivity table | ✅ Replay runner |
| **AI layer** | Provider-agnostic LLM, degrades to rules | Heuristics only |
| **Canon mapping** | Explicit 1:1 table to their pipeline | Implicit |
| **Risk math** | Liquidity-aware Kelly on walked book + net-edge gating | Fractional Kelly + flat caps |
| **Hot reload** | No | Yes (Kelly, EV, stops) |

---

## What we did better and why it didn't matter

- **3.4× the test count.** Judges don't read test files.
- **Injury Scout.** A real-world, sub-minute reaction signal with ESPN integration. They have nothing like it. But it's directional alpha — exactly the game Arbiter argued (correctly) is hard and low-edge.
- **Hot-reloadable config.** Operational maturity. Invisible in a 3-minute video.
- **More signals overall.** Counted against us, not for us — three signals reads as "we couldn't pick one," theirs reads as a thesis.

We optimized for *engineering quality*. The rubric rewarded *product clarity*.

---

## Why Arbiter actually won

Three specific things, in order of impact:

### 1. The framing was the moat
> *"It doesn't predict who wins. It enforces the math the market forgot."*

That sentence is the entire pitch. It tells a judge in 12 words what the bot is, why it's different, and why it's defensible. Ours opens with *"Multi-Signal Oracle"* — generic, every bot is multi-signal.

A reframing like theirs is worth more than 100 tests. It positions the project as a *product category* (a coherence-arbitrage layer) instead of a *hackathon entry*.

### 2. Cross-venue (Polymarket × Kalshi)
Same engine, second data source, fee-aware detector. Probably the single largest feature gap. It's:
- A *demonstration* of the "it generalizes" claim — they don't just say it, they show two venues
- The exact place fat arbs actually live (independent order books that can't both be right)
- A feature no other team likely had

We never considered a second venue. That's a planning failure, not an execution one.

### 3. Live hosted demo
[arbiter-peach.vercel.app](https://arbiter-peach.vercel.app). Judges clicked it. They saw the dashboard. They saw the lattice. They saw live order books.

We submitted a CLI bot. To evaluate ours, a judge has to clone, install, configure, and run. They don't. They watch the video and grade what they saw.

A read-only Vercel page showing the bot's current view of the market would have moved more rubric points than the entire `src/risk/` module did.

---

## Process failures (the part that's on us)

### We picked the obvious bet
"Multiple signals = more edge" is the strategy every other team also picked. Arbiter went orthogonal: *no* prediction, only structural arb. Picking the contrarian frame is a planning decision that has to happen on day 1, not in the final week.

**Lesson:** before writing code, write the pitch. If the pitch isn't *surprising* to a quant, don't ship that pitch.

### We optimized invisible quality
144 tests, hot reload, position-tracker singleton, normalized team names. All correct, none of it visible to a judge in a 3-minute window.

**Lesson:** for a hackathon, every hour of engineering needs a visible counterpart in the demo. If a feature can't show up on screen, it doesn't ship until the visible surface is done.

### We had no clickable artifact
Vercel deploy takes ~2 hours. We had weeks. This was pure planning negligence.

**Lesson:** the demo URL is a P0 deliverable, equal to the source code. It gets scheduled first, not last.

### We over-indexed on Canon mapping after the fact
Both submissions claim Canon integration. Theirs has an explicit 1:1 table. Ours has prose. Side by side, theirs reads as Canon-native; ours reads as Canon-adapted.

**Lesson:** when a rubric specifies a framework (Canon), map your implementation to it *as a table in the README*, not as paragraphs.

---

## What a v2 would look like

If we were to keep building this:

1. **Reframe.** Drop "Multi-Signal Oracle." Pick one thesis that's contrarian and defensible. The injury-scout signal — *"sub-minute reaction to player status changes"* — is actually a real edge. Lead with it, demote the rest.
2. **Add Kalshi.** Same data shape, fee-aware detector. The crossmarket-arb engine already does the math; it just needs a second source.
3. **Vercel dashboard.** Read-only. Live order book view, current signals, paper P&L. Even an ugly one moves the needle.
4. **Cut features that don't render.** The hot-reload watcher, the singleton position tracker — keep them for engineering hygiene, but don't spend more hours there until the demo is shippable.
5. **Write the README as marketing first, docs second.** Open with a quotable line. End with a table. Make a judge able to grade us in 90 seconds.

---

## The thing that's actually worth remembering

The hackathon rubric was:
- Innovation 25%
- Technical 30%
- Real-world utility 30%
- Presentation 15%

We probably won technical. We probably tied utility. We lost innovation and presentation badly enough to swamp the rest.

**Engineering wins projects. Framing wins hackathons.** Next time, write the pitch first.
