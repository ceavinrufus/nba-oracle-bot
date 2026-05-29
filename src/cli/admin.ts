#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadStore, saveStore, calculatePositionPnl } from '../portfolio/tracker.js';

const CANON_DIR = resolve(process.cwd(), '.canon');
const PAUSE_FLAG = resolve(CANON_DIR, 'pause.flag');
const STATE_PATH = resolve(CANON_DIR, 'state.json');

function ensureCanon(): void {
  if (!existsSync(CANON_DIR)) mkdirSync(CANON_DIR, { recursive: true });
}

export function cmdStatus(): void {
  if (!existsSync(STATE_PATH)) {
    console.log('No state file found. Bot may not be running.');
    return;
  }
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  console.log('=== NBA Oracle Bot Status ===');
  console.log(`Phase:    ${state.phase}`);
  console.log(`Status:   ${state.status}`);
  console.log(`Strategy: ${state.strategy}`);
  console.log(`Scans:    ${state.metrics?.scans ?? 0}`);
  console.log(`Opps:     ${state.metrics?.opportunities_found ?? 0}`);
  console.log(`Trades:   ${state.metrics?.trades_executed ?? 0}`);
  console.log(`P&L:      $${(state.metrics?.pnl_usdc ?? 0).toFixed(2)} USDC`);
  const paused = existsSync(PAUSE_FLAG);
  console.log(`Paused:   ${paused}`);
}

export function cmdPositions(): void {
  const store = loadStore();
  const open = store.positions.filter(p => p.status === 'open');
  if (open.length === 0) {
    console.log('No open positions.');
    return;
  }
  console.log(`=== Open Positions (${open.length}) ===`);
  for (const pos of open) {
    const age = Math.floor((Date.now() - pos.enteredAt) / 60000);
    console.log(`  ${pos.tokenId.slice(0, 16)}... | ${pos.side} | entry=${pos.price.toFixed(3)} | size=$${pos.size.toFixed(2)} | team=${pos.team ?? 'unknown'} | age=${age}min`);
  }
}

export function cmdPnl(): void {
  const store = loadStore();
  const closed = store.positions.filter(p => p.status === 'closed');
  const open = store.positions.filter(p => p.status === 'open');

  const realized = closed.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const wins = closed.filter(p => (p.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length * 100).toFixed(1) : 'N/A';

  console.log('=== P&L Summary ===');
  console.log(`Realized P&L:   $${realized.toFixed(2)} USDC`);
  console.log(`Closed trades:  ${closed.length} (win rate: ${winRate}%)`);
  console.log(`Open positions: ${open.length}`);
}

export function cmdPause(): void {
  ensureCanon();
  writeFileSync(PAUSE_FLAG, new Date().toISOString());
  console.log('Bot paused. Resume with: admin resume');
}

export function cmdResume(): void {
  if (existsSync(PAUSE_FLAG)) {
    unlinkSync(PAUSE_FLAG);
    console.log('Bot resumed.');
  } else {
    console.log('Bot was not paused.');
  }
}

export function cmdCloseAll(): void {
  const store = loadStore();
  const open = store.positions.filter(p => p.status === 'open');
  if (open.length === 0) {
    console.log('No open positions to close.');
    return;
  }
  store.positions = store.positions.map(p =>
    p.status === 'open'
      ? { ...p, status: 'closed' as const, closedAt: Date.now(), resolvedPrice: 0, pnl: calculatePositionPnl(p, 0) }
      : p
  );
  saveStore(store);
  console.log(`Emergency closed ${open.length} positions at price=0.`);
}

const isMain =
  process.argv[1]?.endsWith('admin.ts') ||
  process.argv[1]?.endsWith('admin.js');

if (isMain) {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'status':    cmdStatus(); break;
    case 'positions': cmdPositions(); break;
    case 'pnl':       cmdPnl(); break;
    case 'pause':     cmdPause(); break;
    case 'resume':    cmdResume(); break;
    case 'close-all': cmdCloseAll(); break;
    default:
      console.log('Usage: admin <status|positions|pnl|pause|resume|close-all>');
      process.exit(1);
  }
}
