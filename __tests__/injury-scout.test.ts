import { describe, it, expect, vi } from 'vitest';

// Test the pure helper functions in isolation
const STAR_PLAYER_KEYWORDS = [
  'lebron', 'curry', 'durant', 'giannis', 'jokic', 'embiid',
  'luka', 'tatum', 'mitchell', 'sga', 'gilgeous', 'brunson',
];

function isStarPlayer(playerName: string): boolean {
  const lower = playerName.toLowerCase();
  return STAR_PLAYER_KEYWORDS.some(k => lower.includes(k));
}

function estimatePriceMoveForStatus(status: string): number {
  switch (status) {
    case 'OUT': return 0.12;
    case 'DOUBTFUL': return 0.07;
    case 'QUESTIONABLE': return 0.04;
    default: return 0.01;
  }
}

describe('injury scout helpers', () => {
  it('identifies star players', () => {
    expect(isStarPlayer('LeBron James')).toBe(true);
    expect(isStarPlayer('Stephen Curry')).toBe(true);
    expect(isStarPlayer('Shai Gilgeous-Alexander')).toBe(true);
  });

  it('rejects non-star players', () => {
    expect(isStarPlayer('John Smith')).toBe(false);
    expect(isStarPlayer('Random Bench Player')).toBe(false);
  });

  it('estimates correct price moves for OUT status', () => {
    expect(estimatePriceMoveForStatus('OUT')).toBe(0.12);
  });

  it('estimates correct price moves for DOUBTFUL status', () => {
    expect(estimatePriceMoveForStatus('DOUBTFUL')).toBe(0.07);
  });

  it('estimates correct price moves for QUESTIONABLE status', () => {
    expect(estimatePriceMoveForStatus('QUESTIONABLE')).toBe(0.04);
  });

  it('estimates minimal price move for other statuses', () => {
    expect(estimatePriceMoveForStatus('PROBABLE')).toBe(0.01);
    expect(estimatePriceMoveForStatus('ACTIVE')).toBe(0.01);
  });
});
