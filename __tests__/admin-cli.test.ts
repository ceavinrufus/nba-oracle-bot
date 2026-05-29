import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { cmdStatus, cmdPositions, cmdPnl, cmdPause, cmdResume, cmdCloseAll } from '../src/cli/admin.js';

// Use a temp .canon dir scoped to tests
const CANON_DIR = resolve(process.cwd(), '.canon');
const PAUSE_FLAG = resolve(CANON_DIR, 'pause.flag');
const STATE_PATH = resolve(CANON_DIR, 'state.json');
const POSITIONS_PATH = resolve(CANON_DIR, 'positions.json');

function cleanCanon(): void {
  if (existsSync(PAUSE_FLAG)) unlinkSync(PAUSE_FLAG);
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
  if (existsSync(POSITIONS_PATH)) unlinkSync(POSITIONS_PATH);
}

beforeEach(() => {
  cleanCanon();
  if (!existsSync(CANON_DIR)) mkdirSync(CANON_DIR, { recursive: true });
});

afterEach(() => {
  cleanCanon();
});

describe('admin CLI', () => {
  it('cmdStatus prints "No state file found" when no state.json exists', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdStatus();
    expect(logs.some(l => l.includes('No state file found'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdStatus prints bot status when state.json exists', () => {
    const state = {
      phase: 'scan',
      status: 'running',
      strategy: 'momentum',
      metrics: { scans: 5, opportunities_found: 2, trades_executed: 1, pnl_usdc: 10.5 },
    };
    writeFileSync(STATE_PATH, JSON.stringify(state));
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdStatus();
    expect(logs.some(l => l.includes('NBA Oracle Bot Status'))).toBe(true);
    expect(logs.some(l => l.includes('scan'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdPositions prints "No open positions" when store is empty', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdPositions();
    expect(logs.some(l => l.includes('No open positions'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdPositions lists open positions when they exist', () => {
    const store = {
      positions: [
        {
          tokenId: 'abc123def456ghi789',
          team: 'lakers',
          side: 'BUY',
          price: 0.65,
          size: 50,
          enteredAt: Date.now() - 60000 * 5,
          status: 'open',
        },
      ],
    };
    writeFileSync(POSITIONS_PATH, JSON.stringify(store));
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdPositions();
    expect(logs.some(l => l.includes('Open Positions (1)'))).toBe(true);
    expect(logs.some(l => l.includes('lakers'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdPnl shows $0.00 realized when no closed positions', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdPnl();
    expect(logs.some(l => l.includes('$0.00 USDC'))).toBe(true);
    expect(logs.some(l => l.includes('win rate: N/A'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdPnl calculates win rate correctly for closed positions', () => {
    const store = {
      positions: [
        { tokenId: 'a', side: 'BUY', price: 0.5, size: 10, enteredAt: Date.now(), status: 'closed', pnl: 5 },
        { tokenId: 'b', side: 'BUY', price: 0.5, size: 10, enteredAt: Date.now(), status: 'closed', pnl: -3 },
      ],
    };
    writeFileSync(POSITIONS_PATH, JSON.stringify(store));
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdPnl();
    expect(logs.some(l => l.includes('$2.00 USDC'))).toBe(true);
    expect(logs.some(l => l.includes('50.0%'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdPause creates pause.flag file', () => {
    cmdPause();
    expect(existsSync(PAUSE_FLAG)).toBe(true);
  });

  it('cmdResume deletes pause.flag file', () => {
    writeFileSync(PAUSE_FLAG, new Date().toISOString());
    expect(existsSync(PAUSE_FLAG)).toBe(true);
    cmdResume();
    expect(existsSync(PAUSE_FLAG)).toBe(false);
  });

  it('cmdResume prints "not paused" when no pause.flag', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdResume();
    expect(logs.some(l => l.includes('not paused'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdCloseAll marks all open positions as closed', () => {
    const store = {
      positions: [
        { tokenId: 'tok1', side: 'BUY', price: 0.6, size: 100, enteredAt: Date.now(), status: 'open' },
        { tokenId: 'tok2', side: 'SELL', price: 0.4, size: 50, enteredAt: Date.now(), status: 'open' },
      ],
    };
    writeFileSync(POSITIONS_PATH, JSON.stringify(store));
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdCloseAll();
    expect(logs.some(l => l.includes('Emergency closed 2 positions'))).toBe(true);
    vi.restoreAllMocks();
  });

  it('cmdCloseAll prints "No open positions" when store is empty', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
    cmdCloseAll();
    expect(logs.some(l => l.includes('No open positions to close'))).toBe(true);
    vi.restoreAllMocks();
  });
});
