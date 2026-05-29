#!/usr/bin/env node
// Usage: npm run backtest -- --input data/historical.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBacktest, printBacktestReport, saveBacktestReport, HistoricalMarket } from './runner.js';

const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const bankrollIdx = args.indexOf('--bankroll');
const maxFracIdx = args.indexOf('--max-fraction');

if (inputIdx === -1 || !args[inputIdx + 1]) {
  console.error('Usage: backtest --input <path-to-historical.json> [--bankroll 1000] [--max-fraction 5]');
  process.exit(1);
}

const inputPath = resolve(process.cwd(), args[inputIdx + 1]);
const bankroll = bankrollIdx !== -1 ? parseFloat(args[bankrollIdx + 1]) : 1000;
const maxFraction = maxFracIdx !== -1 ? parseFloat(args[maxFracIdx + 1]) : 5;

const markets: HistoricalMarket[] = JSON.parse(readFileSync(inputPath, 'utf-8'));
const result = runBacktest(markets, bankroll, maxFraction);
printBacktestReport(result);
saveBacktestReport(result);
