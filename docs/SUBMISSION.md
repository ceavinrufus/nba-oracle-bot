# Hackathon Submission Checklist

## Project Details
- Name: NBA Oracle Bot
- Hackathon: DEGA NBA Playoffs Prediction Market Hackathon
- Submission deadline: May 31, 2026
- GitHub: (link here)
- Demo video: (link here)

## Checklist

### Required
- [ ] Project description (README.md)
- [ ] Source code on GitHub (public)
- [ ] Setup documentation (README.md Quick Start)
- [ ] 3-5 minute demo video
- [ ] Execution logs in .canon/execution/

### Technical
- [ ] pnpm run typecheck passes (zero TypeScript errors)
- [ ] pnpm run lint passes (zero lint errors)
- [ ] pnpm test passes (all tests green)
- [ ] pnpm run dry-run completes one full cycle
- [ ] Canon TUI runs via ./canon.sh
- [ ] dega-core.yaml success criteria all passing

### Strategy
- [ ] Injury Scout engine working
- [ ] Cross-Market Arb engine working
- [ ] Series Probability Engine working
- [ ] Kelly position sizing working
- [ ] Dry-run execution logs generated

## Judging Criteria Self-Assessment

| Criteria | Weight | Our Approach |
|---|---|---|
| Innovation & Creativity | 25% | Multi-agent Canon workflow; 3 independent signal engines; novel arb detection |
| Technical Execution | 30% | Full TypeScript types, Vitest tests, oxlint, dega-core.yaml success gates |
| Real World Utility | 30% | Live Polymarket + ESPN data; Kelly sizing; dry-run logs showing real opportunities |
| Presentation | 15% | Canon TUI demo video showing all 3 engines + live dashboard |
