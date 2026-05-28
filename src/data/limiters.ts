import { RateLimiter } from '../utils/rate-limiter.js';

export const espnLimiter = new RateLimiter(2, { maxFailures: 5, circuitBreakDurationMs: 60_000 });
export const polymarketLimiter = new RateLimiter(5, { maxFailures: 5, circuitBreakDurationMs: 30_000 });
