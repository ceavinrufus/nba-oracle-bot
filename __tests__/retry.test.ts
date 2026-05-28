import { describe, it, expect } from 'vitest';
import { withRetry } from '../src/utils/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries on failure and succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(() => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return Promise.resolve('ok');
    }, 3, 10);
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after max attempts exhausted', async () => {
    await expect(
      withRetry(() => Promise.reject(new Error('always fails')), 3, 10)
    ).rejects.toThrow('always fails');
  });

  it('respects maxAttempts=1 (no retry)', async () => {
    let attempts = 0;
    await expect(
      withRetry(() => { attempts++; return Promise.reject(new Error('fail')); }, 1, 10)
    ).rejects.toThrow('fail');
    expect(attempts).toBe(1);
  });
});
