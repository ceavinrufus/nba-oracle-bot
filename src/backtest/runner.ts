import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { kellySize } from '../execution/kelly.js';

export interface HistoricalMarket {
  tokenId: string;
  question: string;
  team: string;
  side: 'home' | 'away';
  marketPrice: number;      // implied prob at signal time
  modelProb: number;        // our model's probability
  resolvedPrice: number;    // 1.0 = won, 0.0 = lost
  signalDate: string;       // ISO date
}

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnlUsdc: number;
  roi: number;              // pnl / total staked
  avgEv: number;
  avgKellyFraction: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  tokenId: string;
  question: string;
  team: string;
  modelProb: number;
  marketPrice: number;
  ev: number;
  kellyFraction: number;
  sizeUsdc: number;
  resolvedPrice: number;
  pnlUsdc: number;
  won: boolean;
}

export function runBacktest(
  markets: HistoricalMarket[],
  bankrollUsdc = 1000,
  _maxFractionPct = 5
): BacktestResult {
  const trades: BacktestTrade[] = [];
  let runningBankroll = bankrollUsdc;
  let totalStaked = 0;

  for (const m of markets) {
    const ev = (m.modelProb - m.marketPrice) / m.marketPrice;
    if (ev <= 0) continue; // skip negative EV

    const sizeUsdc = kellySize(m.modelProb, m.marketPrice, runningBankroll);
    if (sizeUsdc < 1) continue;

    const kellyFraction = sizeUsdc / runningBankroll;
    const pnlUsdc = m.resolvedPrice > 0.5
      ? sizeUsdc * (1 / m.marketPrice - 1)  // win: profit at market odds
      : -sizeUsdc;                            // loss: lose stake

    runningBankroll += pnlUsdc;
    totalStaked += sizeUsdc;

    trades.push({
      tokenId: m.tokenId,
      question: m.question,
      team: m.team,
      modelProb: m.modelProb,
      marketPrice: m.marketPrice,
      ev,
      kellyFraction,
      sizeUsdc,
      resolvedPrice: m.resolvedPrice,
      pnlUsdc,
      won: m.resolvedPrice > 0.5,
    });
  }

  const wins = trades.filter(t => t.won).length;
  const totalPnlUsdc = runningBankroll - bankrollUsdc;
  const avgEv = trades.length > 0 ? trades.reduce((s, t) => s + t.ev, 0) / trades.length : 0;
  const avgKellyFraction = trades.length > 0 ? trades.reduce((s, t) => s + t.kellyFraction, 0) / trades.length : 0;

  // Sharpe: mean pnl / stddev pnl (per trade)
  const pnls = trades.map(t => t.pnlUsdc);
  const meanPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length > 1 ? pnls.reduce((s, p) => s + (p - meanPnl) ** 2, 0) / (pnls.length - 1) : 1;
  const sharpeRatio = variance > 0 ? meanPnl / Math.sqrt(variance) : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: trades.length > 0 ? wins / trades.length : 0,
    totalPnlUsdc,
    roi: totalStaked > 0 ? totalPnlUsdc / totalStaked : 0,
    avgEv,
    avgKellyFraction,
    sharpeRatio,
    trades,
  };
}

export function printBacktestReport(result: BacktestResult): void {
  console.log('\n=== BACKTEST REPORT ===');
  console.log(`Trades:     ${result.totalTrades} (${result.wins}W / ${result.losses}L)`);
  console.log(`Win Rate:   ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`Total PnL:  $${result.totalPnlUsdc.toFixed(2)} USDC`);
  console.log(`ROI:        ${(result.roi * 100).toFixed(2)}%`);
  console.log(`Avg EV:     ${(result.avgEv * 100).toFixed(2)}%`);
  console.log(`Avg Kelly:  ${(result.avgKellyFraction * 100).toFixed(2)}%`);
  console.log(`Sharpe:     ${result.sharpeRatio.toFixed(3)}`);
  console.log('=======================\n');
}

export function saveBacktestReport(result: BacktestResult, outputPath?: string): void {
  const dir = resolve(process.cwd(), '.canon/backtest');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = outputPath ?? resolve(dir, `backtest-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2));
  console.log(`[BACKTEST] Report saved to ${path}`);
}
