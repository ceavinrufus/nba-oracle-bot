import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { env } from '../env.js';
import { TradeResult } from '../types.js';

class Logger {
  private logPath: string;

  constructor() {
    mkdirSync(env.logDir, { recursive: true });
    this.logPath = join(env.logDir, 'trades.jsonl');
  }

  log(result: Partial<TradeResult> & Record<string, unknown>): void {
    const line = JSON.stringify({ ...result, timestamp: Date.now() });
    appendFileSync(this.logPath, line + '\n');
  }
}

export const logger = new Logger();
