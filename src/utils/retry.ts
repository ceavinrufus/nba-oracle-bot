export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      const jitter = Math.random() * delay * 0.3;
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
  throw new Error('unreachable');
}
