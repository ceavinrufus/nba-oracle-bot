import { watch, FSWatcher } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

export interface HotConfig {
  stopLossPct: number;
  takeProfitPct: number;
  kellyFraction: number;
  minEvThreshold: number;
  maxPositionUsdc: number;
}

let _current: HotConfig | null = null;
let _watcher: FSWatcher | null = null;
let _envPathOverride: string | null = null;

export function _setEnvPathForTesting(p: string | null): void {
  _envPathOverride = p;
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const lines = readFileSync(path, 'utf-8').split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

function loadFromEnv(): HotConfig {
  const envPath = _envPathOverride ?? resolve(process.cwd(), '.env');
  const parsed = parseEnvFile(envPath);

  // Fall back to process.env for each key
  const get = (key: string, fallback: string) =>
    parsed[key] ?? process.env[key] ?? fallback;

  return {
    stopLossPct: parseFloat(get('STOP_LOSS_PCT', '0.25')),
    takeProfitPct: parseFloat(get('TAKE_PROFIT_PCT', '0.50')),
    kellyFraction: parseFloat(get('KELLY_FRACTION', '0.25')),
    minEvThreshold: parseFloat(get('MIN_EV_THRESHOLD', '0.05')),
    maxPositionUsdc: parseFloat(get('MAX_POSITION_USDC', '50')),
  };
}

export function getHotConfig(): HotConfig {
  if (!_current) _current = loadFromEnv();
  return _current;
}

export function startConfigWatcher(onReload?: (config: HotConfig) => void): void {
  const envPath = _envPathOverride ?? resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    console.log('[CONFIG-WATCHER] No .env file found, using defaults');
    _current = loadFromEnv();
    return;
  }

  _current = loadFromEnv();
  console.log('[CONFIG-WATCHER] Watching .env for changes...');

  _watcher = watch(envPath, { persistent: false }, (event) => {
    if (event !== 'change') return;
    try {
      const prev = _current;
      _current = loadFromEnv();
      const changed = JSON.stringify(prev) !== JSON.stringify(_current);
      if (changed) {
        console.log('[CONFIG-WATCHER] Config reloaded:', JSON.stringify(_current));
        onReload?.(_current);
      }
    } catch (err) {
      console.error('[CONFIG-WATCHER] Failed to reload config:', err);
    }
  });
}

export function stopConfigWatcher(): void {
  _watcher?.close();
  _watcher = null;
}

// Reset internal state (for testing)
export function _resetForTesting(): void {
  _current = null;
  _envPathOverride = null;
  _watcher?.close();
  _watcher = null;
}
