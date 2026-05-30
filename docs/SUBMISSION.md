# Hackathon Submission Checklist

## Project Details
- Name: NBA Oracle Bot
- Hackathon: DEGA NBA Playoffs Prediction Market Hackathon
- Submission deadline: May 31, 2026
- GitHub: https://github.com/ceavinrufus/nba-oracle-bot
- Demo video: https://www.youtube.com/watch?v=Hy_pef4abrM

## Checklist

### Required
- [x] Project description (README.md)
- [x] Source code on GitHub (public)
- [x] Setup documentation (README.md Quick Start)
- [x] 3-5 minute demo video
- [x] Execution logs in .canon/execution/

### Technical
- [x] pnpm run typecheck passes (zero TypeScript errors)
- [x] pnpm run lint passes (zero lint errors)
- [x] pnpm test passes (all tests green)
- [x] pnpm run dry-run completes one full cycle
- [x] dega-core.yaml success criteria all passing

### Strategy
- [x] Injury Scout engine working
- [x] Cross-Market Arb engine working
- [x] Series Probability Engine working
- [x] Kelly position sizing working
- [x] Dry-run execution logs generated

## Judging Criteria Self-Assessment

| Criteria | Weight | Our Approach |
|---|---|---|
| Innovation & Creativity | 25% | Multi-agent Canon workflow; 3 independent signal engines; novel arb detection |
| Technical Execution | 30% | Full TypeScript types, Vitest tests, oxlint, dega-core.yaml success gates |
| Real World Utility | 30% | Live Polymarket + ESPN data; Kelly sizing; dry-run logs showing real opportunities |
| Presentation | 15% | Canon TUI demo video showing all 3 engines + live dashboard |
