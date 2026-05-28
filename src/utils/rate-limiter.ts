/**
 * Token bucket rate limiter.
 * Allows up to `requestsPerSecond` calls per second.
 * Extra calls are queued and released when tokens refill.
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRateMs: number;
  private lastRefill: number;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private readonly maxFailures: number;
  private readonly circuitBreakDurationMs: number;

  constructor(
    requestsPerSecond: number,
    options: { maxFailures?: number; circuitBreakDurationMs?: number } = {}
  ) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRateMs = 1000 / requestsPerSecond;
    this.lastRefill = Date.now();
    this.maxFailures = options.maxFailures ?? 5;
    this.circuitBreakDurationMs = options.circuitBreakDurationMs ?? 60_000;
  }

  async throttle(): Promise<void> {
    // Check circuit breaker
    if (Date.now() < this.circuitOpenUntil) {
      throw new Error(`Circuit breaker open — backing off until ${new Date(this.circuitOpenUntil).toISOString()}`);
    }

    // Refill tokens
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed / this.refillRateMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for next token
    const waitMs = (1 - this.tokens) * this.refillRateMs;
    await new Promise(r => setTimeout(r, waitMs));
    this.tokens = 0;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.circuitOpenUntil = Date.now() + this.circuitBreakDurationMs;
      console.error(`[CIRCUIT BREAKER] Opened until ${new Date(this.circuitOpenUntil).toISOString()}`);
    }
  }

  isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }
}
