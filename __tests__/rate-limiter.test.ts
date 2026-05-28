import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to requestsPerSecond immediate calls', async () => {
    const limiter = new RateLimiter(3);
    // Three calls should resolve without waiting
    const p1 = limiter.throttle();
    const p2 = limiter.throttle();
    const p3 = limiter.throttle();
    await expect(Promise.all([p1, p2, p3])).resolves.toBeDefined();
  });

  it('queues calls that exceed the token budget', async () => {
    const limiter = new RateLimiter(2);
    // Use up both tokens
    await limiter.throttle();
    await limiter.throttle();

    // This call needs to wait
    let resolved = false;
    const waitPromise = limiter.throttle().then(() => { resolved = true; });

    expect(resolved).toBe(false);
    // Advance time to refill a token
    vi.advanceTimersByTime(600);
    await waitPromise;
    expect(resolved).toBe(true);
  });

  it('opens circuit breaker after maxFailures consecutive failures', () => {
    const limiter = new RateLimiter(5, { maxFailures: 3, circuitBreakDurationMs: 10_000 });
    expect(limiter.isCircuitOpen()).toBe(false);
    limiter.recordFailure();
    limiter.recordFailure();
    expect(limiter.isCircuitOpen()).toBe(false);
    limiter.recordFailure(); // 3rd — opens circuit
    expect(limiter.isCircuitOpen()).toBe(true);
  });

  it('throws when circuit breaker is open', async () => {
    const limiter = new RateLimiter(5, { maxFailures: 2, circuitBreakDurationMs: 10_000 });
    limiter.recordFailure();
    limiter.recordFailure(); // circuit opens

    await expect(limiter.throttle()).rejects.toThrow('Circuit breaker open');
  });

  it('resets consecutive failure count on recordSuccess', () => {
    const limiter = new RateLimiter(5, { maxFailures: 5, circuitBreakDurationMs: 10_000 });
    limiter.recordFailure();
    limiter.recordFailure();
    limiter.recordFailure();
    limiter.recordSuccess(); // resets
    // 2 more failures should not open circuit (need 5 consecutive)
    limiter.recordFailure();
    limiter.recordFailure();
    expect(limiter.isCircuitOpen()).toBe(false);
  });

  it('circuit breaker closes after duration elapses', () => {
    const limiter = new RateLimiter(5, { maxFailures: 2, circuitBreakDurationMs: 5_000 });
    limiter.recordFailure();
    limiter.recordFailure();
    expect(limiter.isCircuitOpen()).toBe(true);

    vi.advanceTimersByTime(5_001);
    expect(limiter.isCircuitOpen()).toBe(false);
  });
});
