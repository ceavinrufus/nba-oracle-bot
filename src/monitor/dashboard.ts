import { writeFileSync, mkdirSync } from 'fs';
import { CanonState } from '../types.js';

const STATE_FILE = '.canon/state.json';

let state: CanonState = {
  phase: 'initializing',
  status: 'Starting NBA Oracle Bot...',
  strategy: 'nba-oracle-bot',
  signals: {
    injury_scout: 'idle',
    crossmarket_arb: 'idle',
    series_probability: 'idle',
  },
  metrics: {
    scans: 0,
    opportunities_found: 0,
    trades_executed: 0,
    pnl_usdc: 0,
  },
  logs: [],
};

function flush(): void {
  mkdirSync('.canon', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export const dashboard = {
  setPhase(phase: CanonState['phase'], status: string): void {
    state.phase = phase;
    state.status = status;
    flush();
  },

  setSignalStatus(
    signal: keyof CanonState['signals'],
    status: CanonState['signals'][typeof signal],
  ): void {
    state.signals[signal] = status;
    flush();
  },

  recordScan(): void {
    state.metrics.scans++;
    flush();
  },

  recordOpportunity(): void {
    state.metrics.opportunities_found++;
    flush();
  },

  recordTrade(pnlDelta: number): void {
    state.metrics.trades_executed++;
    state.metrics.pnl_usdc += pnlDelta;
    flush();
  },

  addLog(message: string): void {
    const ts = new Date().toISOString().substring(11, 19); // HH:MM:SS
    state.logs = [`[${ts}] ${message}`, ...state.logs].slice(0, 50); // keep last 50
    flush();
  },

  getState(): CanonState {
    return { ...state };
  },
};
