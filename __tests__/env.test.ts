import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loads trading mode default as dry-run', async () => {
    delete process.env['TRADING_MODE'];
    const { env } = await import('../src/env.js');
    expect(env.tradingMode).toBe('dry-run');
  });

  it('parses numeric env vars', async () => {
    process.env['KELLY_FRACTION'] = '0.25';
    const { env } = await import('../src/env.js');
    expect(env.kellyFraction).toBe(0.25);
  });
});
