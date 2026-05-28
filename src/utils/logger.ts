import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { env } from '../env.js';
import { TradeResult } from '../types.js';

class Logger {
  private logPath: string;

  constructor() {
    mkdirSync(env.logDir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    this.logPath = join(env.logDir, `trades-${date}.jsonl`);
  }

  log(result: TradeResult): void {
    const entry = JSON.stringify({
      ...result,
      timestamp: new Date().toISOString(),
    });
    appendFileSync(this.logPath, entry + '\n');
  }

  info(message: string, data?: Record<string, unknown>): void {
    const entry = JSON.stringify({
      type: 'INFO',
      message,
      data,
      timestamp: new Date().toISOString(),
    });
    appendFileSync(this.logPath, entry + '\n');
    console.log(`[INFO] ${message}`);
  }

  error(message: string, err?: unknown): void {
    const entry = JSON.stringify({
      type: 'ERROR',
      message,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
    appendFileSync(this.logPath, entry + '\n');
    console.error(`[ERROR] ${message}`);
  }
}

export const logger = new Logger();
