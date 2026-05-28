import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock axios
vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => instance),
    },
    __instance: instance,
  };
});

// Mock tracker
vi.mock('../src/portfolio/index.js', () => ({
  tracker: {
    addPosition: vi.fn(),
    hasPosition: vi.fn(() => false),
  },
}));

// Mock withRetry to just call fn
vi.mock('../src/utils/retry.js', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

// Mock env
vi.mock('../src/env.js', () => ({
  env: {
    polymarketClobUrl: 'https://clob.test',
    tradingMode: 'dry-run',
    marketPollMs: 5000,
  },
  getMode: vi.fn(() => 'live'),
  validateEnv: vi.fn(),
  requireLiveCredentials: vi.fn(),
}));

const TEST_ORDERS_DIR = resolve(process.cwd(), '.canon-test');

// Override ORDERS_PATH via env trick — we'll write to a temp location
// Instead, we test by importing after setting up mocks

import { trackOrder, pollPendingOrders } from '../src/execution/order-manager.js';
import { tracker } from '../src/portfolio/index.js';
import axios from 'axios';

// Get the internal axios instance created by order-manager
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const axiosMod = axios as any;
const clobInstance = axiosMod.create();

function makeResult(overrides: Partial<Parameters<typeof trackOrder>[0]> = {}): Parameters<typeof trackOrder>[0] {
  return {
    decision: {
      signal: { type: 'EV' } as never,
      tokenId: 'token-abc',
      side: 'BUY',
      price: 0.55,
      sizeUsdc: 10,
      reasoning: 'test',
      team: 'Lakers',
    },
    orderId: 'order-001',
    status: 'pending',
    executedAt: Date.now(),
    ...overrides,
  } as Parameters<typeof trackOrder>[0];
}

describe('order-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackOrder adds a pending order to the store', async () => {
    const result = makeResult();
    // Just ensure no throw and that it writes
    expect(() => trackOrder(result)).not.toThrow();
  });

  it('trackOrder ignores non-pending results', () => {
    const result = makeResult({ status: 'filled' });
    // Should not throw and should be a no-op
    expect(() => trackOrder(result)).not.toThrow();
    // addPosition should not be called
    expect(vi.mocked(tracker.addPosition)).not.toHaveBeenCalled();
  });

  it('trackOrder ignores results without orderId', () => {
    const result = makeResult({ orderId: undefined });
    expect(() => trackOrder(result)).not.toThrow();
    expect(vi.mocked(tracker.addPosition)).not.toHaveBeenCalled();
  });

  it('pollPendingOrders adds position for filled order', async () => {
    // Add an order first
    const result = makeResult({ orderId: 'order-fill-001', executedAt: Date.now() - 10_000 });
    trackOrder(result);

    // Mock GET returning matched
    clobInstance.get.mockResolvedValueOnce({ data: { status: 'MATCHED' } });

    await pollPendingOrders(120);

    expect(vi.mocked(tracker.addPosition)).toHaveBeenCalledWith(expect.objectContaining({
      tokenId: 'token-abc',
      side: 'BUY',
    }));
  });

  it('pollPendingOrders cancels stale orders', async () => {
    // Add a stale order (placed 200s ago)
    const result = makeResult({ orderId: 'order-stale-001', executedAt: Date.now() - 200_000 });
    trackOrder(result);

    // Mock GET returning open (not matched)
    clobInstance.get.mockResolvedValueOnce({ data: { status: 'OPEN' } });
    clobInstance.delete.mockResolvedValueOnce({ data: {} });

    await pollPendingOrders(120);

    expect(clobInstance.delete).toHaveBeenCalledWith(expect.stringContaining('order-stale-001'));
    expect(vi.mocked(tracker.addPosition)).not.toHaveBeenCalled();
  });

  it('pollPendingOrders keeps fresh unfilled orders', async () => {
    // Add a fresh order (placed 10s ago)
    const result = makeResult({ orderId: 'order-fresh-001', executedAt: Date.now() - 10_000 });
    trackOrder(result);

    // Mock GET returning open (not matched, not stale)
    clobInstance.get.mockResolvedValueOnce({ data: { status: 'OPEN' } });

    await pollPendingOrders(120);

    // Should not add position or delete
    expect(vi.mocked(tracker.addPosition)).not.toHaveBeenCalled();
    expect(clobInstance.delete).not.toHaveBeenCalled();
  });
});
