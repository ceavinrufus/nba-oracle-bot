import { describe, it, expect } from 'vitest';
import {
  computeSeriesProbabilityV2,
  computeInjuryImpact,
  computeRestDaysAdjustment,
  computePlayoffExperienceFactor,
} from '../src/agents/series-probability-v2.js';
import { SeriesState, InjuryReport } from '../src/types.js';

function makeSeries(overrides: Partial<SeriesState> = {}): SeriesState {
  return {
    seriesId: 'test-series',
    homeTeam: {
      teamId: 'OKC',
      teamName: 'Thunder',
      wins: 55,
      losses: 27,
      last10: { wins: 7, losses: 3 },
      homeRecord: { wins: 30, losses: 11 },
      awayRecord: { wins: 25, losses: 16 },
    },
    awayTeam: {
      teamId: 'BOS',
      teamName: 'Celtics',
      wins: 50,
      losses: 32,
      last10: { wins: 6, losses: 4 },
      homeRecord: { wins: 28, losses: 13 },
      awayRecord: { wins: 22, losses: 19 },
    },
    homeWins: 2,
    awayWins: 1,
    currentGame: 4,
    homeCourtTeam: 'OKC',
    ...overrides,
  };
}

describe('Series Probability V2 - Injury Impact', () => {
  it('returns 0 when no injuries for team', () => {
    expect(computeInjuryImpact([], 'Thunder')).toBe(0);
  });

  it('applies -15% for star OUT', () => {
    const injuries: InjuryReport[] = [{
      playerId: 'p1', playerName: 'SGA', teamId: 'OKC', teamName: 'Thunder',
      status: 'OUT', description: 'Knee', reportedAt: Date.now(),
    }];
    expect(computeInjuryImpact(injuries, 'Thunder')).toBe(-0.15);
  });

  it('applies -8% for DOUBTFUL', () => {
    const injuries: InjuryReport[] = [{
      playerId: 'p2', playerName: 'Chet', teamId: 'OKC', teamName: 'Thunder',
      status: 'DOUBTFUL', description: 'Ankle', reportedAt: Date.now(),
    }];
    expect(computeInjuryImpact(injuries, 'Thunder')).toBe(-0.08);
  });

  it('caps at -30% for multiple injuries', () => {
    const injuries: InjuryReport[] = [
      { playerId: 'p1', playerName: 'A', teamId: 'OKC', teamName: 'Thunder', status: 'OUT', description: '', reportedAt: 0 },
      { playerId: 'p2', playerName: 'B', teamId: 'OKC', teamName: 'Thunder', status: 'OUT', description: '', reportedAt: 0 },
      { playerId: 'p3', playerName: 'C', teamId: 'OKC', teamName: 'Thunder', status: 'OUT', description: '', reportedAt: 0 },
    ];
    expect(computeInjuryImpact(injuries, 'Thunder')).toBe(-0.30);
  });
});

describe('Series Probability V2 - Rest Days', () => {
  it('returns -3% for 0 rest days', () => {
    expect(computeRestDaysAdjustment(0)).toBe(-0.03);
  });

  it('returns 0 for 1+ rest days', () => {
    expect(computeRestDaysAdjustment(1)).toBe(0);
    expect(computeRestDaysAdjustment(2)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(computeRestDaysAdjustment(undefined)).toBe(0);
  });
});

describe('Series Probability V2 - Playoff Experience', () => {
  it('returns +2% for 5 appearances', () => {
    expect(computePlayoffExperienceFactor(5)).toBeCloseTo(0.02);
  });

  it('scales linearly', () => {
    expect(computePlayoffExperienceFactor(2)).toBeCloseTo(0.008);
  });

  it('returns 0 for undefined', () => {
    expect(computePlayoffExperienceFactor(undefined)).toBe(0);
  });
});

describe('Series Probability V2 - Full Model', () => {
  it('home team with series lead gets higher probability', () => {
    const series = makeSeries({ homeWins: 3, awayWins: 1 });
    const prob = computeSeriesProbabilityV2(series, [], 'home');
    expect(prob).toBeGreaterThan(0.5);
  });

  it('star OUT reduces team probability', () => {
    const series = makeSeries();
    const injuries: InjuryReport[] = [{
      playerId: 'p1', playerName: 'SGA', teamId: 'OKC', teamName: 'Thunder',
      status: 'OUT', description: 'Knee', reportedAt: Date.now(),
    }];
    const withInjury = computeSeriesProbabilityV2(series, injuries, 'home');
    const without = computeSeriesProbabilityV2(series, [], 'home');
    expect(withInjury).toBeLessThan(without);
  });

  it('tired team (0 rest) has lower probability', () => {
    const series = makeSeries();
    const rested = computeSeriesProbabilityV2(series, [], 'home', { restDays: 2 });
    const tired = computeSeriesProbabilityV2(series, [], 'home', { restDays: 0 });
    expect(tired).toBeLessThan(rested);
  });

  it('clamps between 0.05 and 0.95', () => {
    const series = makeSeries({ homeWins: 3, awayWins: 0 });
    const prob = computeSeriesProbabilityV2(series, [], 'home', { playoffAppearances5yr: 5 });
    expect(prob).toBeLessThanOrEqual(0.95);
    expect(prob).toBeGreaterThanOrEqual(0.05);
  });

  it('opponent injury boosts team probability', () => {
    const series = makeSeries();
    const injuries: InjuryReport[] = [{
      playerId: 'p1', playerName: 'Tatum', teamId: 'BOS', teamName: 'Celtics',
      status: 'OUT', description: 'Ankle', reportedAt: Date.now(),
    }];
    const withOppInjury = computeSeriesProbabilityV2(series, injuries, 'home');
    const without = computeSeriesProbabilityV2(series, [], 'home');
    expect(withOppInjury).toBeGreaterThan(without);
  });
});
