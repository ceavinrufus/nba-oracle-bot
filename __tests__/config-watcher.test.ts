import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getHotConfig,
  startConfigWatcher,
  stopConfigWatcher,
  _resetForTesting,
  _setEnvPathForTesting,
  HotConfig,
} from '../src/utils/config-watcher.js';

let tmpDir: string;
let envPath: string;

beforeEach(() => {
  _resetForTesting();
  tmpDir = mkdtempSync(join(tmpdir(), 'nba-cfg-'));
  envPath = join(tmpDir, '.env');
  // Clear hot-reload-related env vars to ensure defaults are clean
  for (const k of ['STOP_LOSS_PCT', 'TAKE_PROFIT_PCT', 'KELLY_FRACTION', 'MIN_EV_THRESHOLD', 'MAX_POSITION_USDC']) {
    delete process.env[k];
  }
});

afterEach(() => {
  stopConfigWatcher();
  _resetForTesting();
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnv(contents: string) {
  writeFileSync(envPath, contents, 'utf-8');
}

function wait(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

describe('getHotConfig', () => {
  it('returns defaults when no .env file present', () => {
    // Point to a path that does not exist
    _setEnvPathForTesting(join(tmpDir, 'nonexistent.env'));
    const cfg = getHotConfig();
    expect(cfg.stopLossPct).toBe(0.25);
    expect(cfg.takeProfitPct).toBe(0.50);
    expect(cfg.kellyFraction).toBe(0.25);
    expect(cfg.minEvThreshold).toBe(0.05);
    expect(cfg.maxPositionUsdc).toBe(50);
  });

  it('parses STOP_LOSS_PCT correctly from process.env when no .env file', () => {
    _setEnvPathForTesting(join(tmpDir, 'nonexistent.env'));
    process.env['STOP_LOSS_PCT'] = '0.15';
    const cfg = getHotConfig();
    expect(cfg.stopLossPct).toBe(0.15);
    delete process.env['STOP_LOSS_PCT'];
  });

  it('parses all values from a .env file', () => {
    writeEnv('STOP_LOSS_PCT=0.10\nTAKE_PROFIT_PCT=0.60\nKELLY_FRACTION=0.30\nMIN_EV_THRESHOLD=0.07\nMAX_POSITION_USDC=75\n');
    _setEnvPathForTesting(envPath);
    const cfg = getHotConfig();
    expect(cfg.stopLossPct).toBe(0.10);
    expect(cfg.takeProfitPct).toBe(0.60);
    expect(cfg.kellyFraction).toBe(0.30);
    expect(cfg.minEvThreshold).toBe(0.07);
    expect(cfg.maxPositionUsdc).toBe(75);
  });
});

describe('startConfigWatcher', () => {
  it('loads config on start with .env present', () => {
    writeEnv('STOP_LOSS_PCT=0.20\n');
    _setEnvPathForTesting(envPath);
    startConfigWatcher();
    const cfg = getHotConfig();
    expect(cfg.stopLossPct).toBe(0.20);
  });

  it('uses defaults when no .env present on start', () => {
    _setEnvPathForTesting(join(tmpDir, 'nonexistent.env'));
    startConfigWatcher();
    const cfg = getHotConfig();
    expect(cfg.stopLossPct).toBe(0.25);
  });

  it('calls onReload callback when .env changes', async () => {
    writeEnv('STOP_LOSS_PCT=0.20\n');
    _setEnvPathForTesting(envPath);
    const reloaded: HotConfig[] = [];
    startConfigWatcher((cfg) => reloaded.push(cfg));

    await wait(50);
    writeEnv('STOP_LOSS_PCT=0.35\n');
    await wait(300);

    expect(reloaded.length).toBeGreaterThan(0);
    expect(reloaded[reloaded.length - 1].stopLossPct).toBe(0.35);
  });
});

describe('stopConfigWatcher', () => {
  it('does not throw when called without starting', () => {
    expect(() => stopConfigWatcher()).not.toThrow();
  });

  it('does not throw when called after starting', () => {
    writeEnv('STOP_LOSS_PCT=0.20\n');
    _setEnvPathForTesting(envPath);
    startConfigWatcher();
    expect(() => stopConfigWatcher()).not.toThrow();
  });
});
