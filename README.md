# 🔍 DEGA & Canon CLI — Deep Research Report

> Research conducted: May 27, 2026  
> Hackathon: [NBA Prediction Market Hackathon on DoraHacks](https://dorahacks.io/hackathon/nba-prediction-market/detail)

---

## 1. What is DEGA?

**DEGA** (dega.org) is a **Web3 tooling company** founded in **November 2022** by CEO **Carlos Rene**. Originally incubated in the Ethereum/Cardano ecosystems, they position themselves at the intersection of **Web3 gaming, AI agent tooling, and prediction market infrastructure**.

- **Tagline:** *"We're creating the world's easiest AI Agent builder"* / *"Your Story. Your World. Mint your Masterpiece."*
- **Vision:** *"Empower millions of creators worldwide to break the mold and forge revolutionary gaming experiences."*
- **Mission:** *"Build the tools that democratize game creation for all."*
- **Pivot:** Started as a no-code Web3 game dev platform (v1 API targeting AAA gaming studios). Now pivoting heavily into **AI agent automation** and **prediction market tooling**.

### Funding / Tokenomics
- Has a **$DEGA token** with TGE (Token Generation Event) contracts in their GitHub
- Did a **multi-chain ISPO** (Initial Stake Pool Offering) across **Cardano and Polkadot**, allocating **9.375 billion $DEGA (25% of total supply)** as rewards
- Implied early investor/partner relationships with "AAA gaming studios" (unnamed)
- Media presence: Crypto Banter, Bitcoin Insider, Hacker Noon

### Team
- Primary GitHub committer: **CerratoA** (aligned with CEO Carlos Rene)
- Uses AI-assisted development heavily (Claude appears as commit co-author)

---

## 2. Canon CLI — What It Actually Is

### GitHub: `DEGAorg/canon-tui` (public)
🔗 https://github.com/DEGAorg/canon-tui

- **Forked from:** `batrachianai/toad` (a Textual-based TUI framework)
- **186 commits ahead** of upstream, 1,123 total commits — very active, substantially customized fork
- **44 branches, 40 tags** — signs of a real product release cycle
- **Language:** Python (Textual framework)
- **License:** AGPL-3.0

### What Canon Is
Canon is a **terminal user interface (TUI) / CLI** that functions as a **unified interface for AI coding agents** in your terminal. A terminal-native wrapper that lets you run, manage, and interact with various AI coding agents (Claude, Gemini, Codex, OpenHands, etc.) from a single UI.

### Core Features
- **App Store** — Find, install, and run dozens of AI agents directly via [Agent Client Protocol (ACP)](https://agentclientprotocol.com)
- **Canon Shell** — Full interactive shell within the TUI (persistent env vars, tab completion)
- **Prompt Editor** — Markdown editor with syntax highlighting, mouse support
- **File Picker** — Fuzzy `@@` file insertion into prompts
- **Beautiful Diffs** — Side-by-side/unified diffs with syntax highlighting
- **Concurrent Sessions** — Run multiple agents simultaneously
- **Web Server Mode** — `canon serve` runs it as a web app
- **Install:** `pipx install -U canon-tui` / `uv tool install -U canon-tui`

### Roadmap (from README)
- UI for MCP servers
- Multiple LLM selection
- Session renaming
- Multiple agents per session
- Native Windows support
- Built-in editor, Docker container, Notification system

### Open Source Status
✅ **Open source** — AGPL-3.0. Not being sold. Primarily a **DevRel/ecosystem tool** to onboard developers into DEGA's hackathons.

---

## 3. DEGA's Business Model

DEGA's current primary product focus has shifted to **prediction market automation**. Canon CLI is the entry-point for their **prediction market developer platform**.

### NBA Playoffs Prediction Market Hackathon (May 4 – June 1, 2026)
- Hosted on **DoraHacks**, global, fully virtual, ~$1,000 USD prize pool
- **Canon is the central tool:** *"DEGA's open-source CLI that scaffolds, runs, and monitors prediction market automations from the terminal"*
- 5 free workshops from zero to live execution
- **Target platforms:** Polymarket-style markets (NBA Playoffs)
- Stack: Canon CLI, pre-built TypeScript templates, specialized AI agents, live P&L dashboard & leaderboard

### Post-Hackathon Pipeline
> **"Top performers will receive promotion across DEGA channels and an early invite to the upcoming World Cup Prediction Market Hackathon."**

Confirms a **hackathon series strategy**: NBA → World Cup (FIFA 2026) → further sports/event markets.

---

## 4. What DEGA is Positioning Canon CLI As

| Layer | What it is |
|---|---|
| **Canon TUI** | General-purpose terminal AI agent interface (open source, community tool) |
| **Canon for Prediction Markets** | DEGA's vertical application — scaffold, run, and monitor trading automations |
| **DEGA Platform** | Prediction market developer infrastructure (leaderboards, P&L tracking, market data APIs) |
| **$DEGA Token** | Ecosystem token (currently tied to Web3/gaming roots, future utility unclear) |

---

## 5. What They're Trying to Prove With the Hackathon

1. **Validate Canon CLI as a devtools product** — get real developers using it, shipping real code
2. **Build a prediction market developer ecosystem** — be the platform developers use to build trading bots for Polymarket, Kalshi, etc.
3. **Pipeline for FIFA World Cup hackathon** — NBA event is a warm-up/funnel for a much bigger event in 2026
4. **Community/attention growth** — DoraHacks listing, Discord, YouTube workshops (DevRel + community building)
5. **Prove Canon (no-code AI agents) can make prediction market automation accessible to non-developers**

---

## Summary Table

| Question | Answer |
|---|---|
| Company type | Web3 → AI devtools pivot; prediction market infrastructure |
| Founded | November 2022, CEO Carlos Rene |
| Token | $DEGA (multi-chain ISPO Cardano/Polkadot) |
| Canon CLI | Open-source terminal AI agent interface (Python/Textual, AGPL-3.0) |
| GitHub | `DEGAorg/canon-tui` — public, active, 1,123 commits |
| Forked from | `batrachianai/toad` |
| Primary use case | Scaffolding + running prediction market trading automations |
| Business model | Developer platform for prediction market automation + $DEGA token ecosystem |
| Hackathon purpose | NBA playoffs → World Cup 2026 hackathon series; Canon adoption + community building |
| Next up | World Cup Prediction Market Hackathon; MCP server support, multi-agent, Windows |
