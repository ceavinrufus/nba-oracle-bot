import { env } from '../env.js';

let _killed = false;

export function isKilled(): boolean {
  return _killed || env.killSwitch;
}

export function kill(reason: string): void {
  _killed = true;
  console.error(`[KILL SWITCH] Trading halted: ${reason}`);
}

export function checkKillSwitch(): void {
  if (isKilled()) {
    throw new Error('Kill switch active — trading halted');
  }
}
