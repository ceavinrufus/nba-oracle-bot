import { describe, it, expect, vi, beforeEach } from 'vitest';
import { americanToImplied, getOddsModelProb, fetchNBAOdds, OddsGame } from '../src/data/odds-api.js';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock env
vi.mock('../src/env.js', () => ({
  env: {
    oddsApiKey: '',
    oddsApiBase: 'https://api.the-odds-api.com/v4',
  },
}));

const mockGames: OddsGame[] = [
  {
    id: 'game1',
    sport_key: 'basketball_nba',
    commence_time: '2026-05-30T00:00:00Z',
    home_team: 'Los Angeles Lakers',
    away_team: 'Golden State Warriors',
    bookmakers: [
      {
        key: 'draftkings',
        title: 'DraftKings',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: -150 },
              { name: 'Golden State Warriors', price: +130 },
            ],
          },
        ],
      },
      {
        key: 'fanduel',
        title: 'FanDuel',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: -140 },
              { name: 'Golden State Warriors', price: +120 },
            ],
          },
        ],
      },
    ],
  },
];

describe('americanToImplied', () => {
  it('converts positive odds correctly (+150 → 0.4)', () => {
    expect(americanToImplied(150)).toBeCloseTo(0.4, 5);
  });

  it('converts negative odds correctly (-150 → 0.6)', () => {
    expect(americanToImplied(-150)).toBeCloseTo(0.6, 5);
  });

  it('converts even odds (+100 → 0.5)', () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 5);
  });
});

describe('getOddsModelProb', () => {
  it('returns null when no matching game', () => {
    const result = getOddsModelProb(mockGames, 'Boston Celtics', 'Miami Heat');
    expect(result).toBeNull();
  });

  it('returns normalized probs averaging across bookmakers', () => {
    const result = getOddsModelProb(mockGames, 'Los Angeles Lakers', 'Golden State Warriors');
    expect(result).not.toBeNull();
    expect(result!.home).toBeGreaterThan(0);
    expect(result!.away).toBeGreaterThan(0);
  });

  it('removes vig — home + away probs sum to ~1.0 after normalization', () => {
    const result = getOddsModelProb(mockGames, 'Los Angeles Lakers', 'Golden State Warriors');
    expect(result).not.toBeNull();
    expect(result!.home + result!.away).toBeCloseTo(1.0, 5);
  });

  it('returns null when game has no bookmakers', () => {
    const emptyGame: OddsGame[] = [{
      ...mockGames[0],
      bookmakers: [],
    }];
    const result = getOddsModelProb(emptyGame, 'Los Angeles Lakers', 'Golden State Warriors');
    expect(result).toBeNull();
  });
});

describe('fetchNBAOdds', () => {
  it('returns empty array when no API key configured', async () => {
    // env mock has oddsApiKey: '' so it should return []
    const result = await fetchNBAOdds();
    expect(result).toEqual([]);
  });
});
