import { describe, it, expect } from 'vitest';
import { runBacktest, HistoricalMarket } from '../src/backtest/runner.js';

const sampleMarkets: HistoricalMarket[] = [
  { tokenId: 'tok-001', question: 'Lakers win', team: 'Lakers', side: 'home', marketPrice: 0.45, modelProb: 0.58, resolvedPrice: 1.0, signalDate: '2024-04-20' },
  { tokenId: 'tok-002', question: 'Celtics win', team: 'Celtics', side: 'home', marketPrice: 0.60, modelProb: 0.72, resolvedPrice: 1.0, signalDate: '2024-04-21' },
  { tokenId: 'tok-003', question: 'Warriors win', team: 'Warriors', side: 'away', marketPrice: 0.38, modelProb: 0.50, resolvedPrice: 0.0, signalDate: '2024-04-22' },
  { tokenId: 'tok-004', question: 'Heat win', team: 'Heat', side: 'away', marketPrice: 0.42, modelProb: 0.30, resolvedPrice: 0.0, signalDate: '2024-04-23' }, // negative EV
  { tokenId: 'tok-005', question: 'Nuggets win', team: 'Nuggets', side: 'home', marketPrice: 0.55, modelProb: 0.68, resolvedPrice: 1.0, signalDate: '2024-04-24' },
];

describe('runBacktest', () => {
  it('returns 0 trades for empty input', () => {
    const result = runBacktest([]);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
  });

  it('skips negative EV markets', () => {
    // tok-004 has modelProb 0.30 < marketPrice 0.42 → negative EV
    const result = runBacktest(sampleMarkets);
    const tokenIds = result.trades.map(t => t.tokenId);
    expect(tokenIds).not.toContain('tok-004');
  });

  it('correctly calculates win PnL (profit at market odds)', () => {
    const market: HistoricalMarket = {
      tokenId: 'win-test', question: 'Test', team: 'Team', side: 'home',
      marketPrice: 0.5, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-04-25',
    };
    const result = runBacktest([market], 1000);
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    // win: sizeUsdc * (1/0.5 - 1) = sizeUsdc * 1
    expect(trade.pnlUsdc).toBeCloseTo(trade.sizeUsdc * (1 / 0.5 - 1), 5);
    expect(trade.pnlUsdc).toBeGreaterThan(0);
  });

  it('correctly calculates loss PnL (negative stake)', () => {
    const market: HistoricalMarket = {
      tokenId: 'loss-test', question: 'Test', team: 'Team', side: 'away',
      marketPrice: 0.4, modelProb: 0.55, resolvedPrice: 0.0, signalDate: '2024-04-25',
    };
    const result = runBacktest([market], 1000);
    expect(result.trades).toHaveLength(1);
    const trade = result.trades[0];
    expect(trade.pnlUsdc).toBeCloseTo(-trade.sizeUsdc, 5);
    expect(trade.won).toBe(false);
  });

  it('returns correct win rate', () => {
    const result = runBacktest(sampleMarkets);
    const { wins, totalTrades, winRate } = result;
    expect(winRate).toBeCloseTo(wins / totalTrades, 10);
  });

  it('ROI is positive for a profitable set of trades', () => {
    // All winning markets with positive EV
    const winningMarkets: HistoricalMarket[] = [
      { tokenId: 'w1', question: 'A', team: 'A', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-01' },
      { tokenId: 'w2', question: 'B', team: 'B', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-02' },
      { tokenId: 'w3', question: 'C', team: 'C', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-03' },
    ];
    const result = runBacktest(winningMarkets, 1000);
    expect(result.roi).toBeGreaterThan(0);
    expect(result.totalPnlUsdc).toBeGreaterThan(0);
  });

  it('sharpe ratio > 0 for net positive trades', () => {
    const winningMarkets: HistoricalMarket[] = [
      { tokenId: 'w1', question: 'A', team: 'A', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-01' },
      { tokenId: 'w2', question: 'B', team: 'B', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-02' },
      { tokenId: 'w3', question: 'C', team: 'C', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 0.0, signalDate: '2024-01-03' },
      { tokenId: 'w4', question: 'D', team: 'D', side: 'home', marketPrice: 0.4, modelProb: 0.6, resolvedPrice: 1.0, signalDate: '2024-01-04' },
    ];
    const result = runBacktest(winningMarkets, 1000);
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });
});
