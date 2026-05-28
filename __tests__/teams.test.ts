import { describe, it, expect } from 'vitest';
import { resolveTeam, NBA_TEAMS } from '../src/data/teams.js';

describe('resolveTeam', () => {
  it('resolves full team name exactly', () => {
    expect(resolveTeam('Boston Celtics')).toBe('boston-celtics');
  });

  it('resolves full team name case-insensitively', () => {
    expect(resolveTeam('boston celtics')).toBe('boston-celtics');
    expect(resolveTeam('BOSTON CELTICS')).toBe('boston-celtics');
    expect(resolveTeam('Boston celtics')).toBe('boston-celtics');
  });

  it('resolves abbreviation alias', () => {
    expect(resolveTeam('OKC')).toBe('oklahoma-city-thunder');
    expect(resolveTeam('gsw')).toBe('golden-state-warriors');
    expect(resolveTeam('LAL')).toBe('los-angeles-lakers');
  });

  it('resolves nickname alias', () => {
    expect(resolveTeam('lakers')).toBe('los-angeles-lakers');
    expect(resolveTeam('celtics')).toBe('boston-celtics');
    expect(resolveTeam('Warriors')).toBe('golden-state-warriors');
    expect(resolveTeam('Sixers')).toBe('philadelphia-76ers');
    expect(resolveTeam('Blazers')).toBe('portland-trail-blazers');
  });

  it('resolves multi-word alias', () => {
    expect(resolveTeam('golden state')).toBe('golden-state-warriors');
    expect(resolveTeam('oklahoma city')).toBe('oklahoma-city-thunder');
  });

  it('resolves team id directly', () => {
    expect(resolveTeam('miami-heat')).toBe('miami-heat');
    expect(resolveTeam('chicago-bulls')).toBe('chicago-bulls');
  });

  it('returns null for garbage input', () => {
    expect(resolveTeam('garbage-team-xyz')).toBeNull();
    expect(resolveTeam('not a real team')).toBeNull();
    expect(resolveTeam('')).toBeNull();
  });

  it('handles mixed case abbreviations', () => {
    expect(resolveTeam('BOS')).toBe('boston-celtics');
    expect(resolveTeam('Bos')).toBe('boston-celtics');
    expect(resolveTeam('bos')).toBe('boston-celtics');
  });

  it('resolves from outcome strings with extra words', () => {
    expect(resolveTeam('OKC Thunder wins series')).toBe('oklahoma-city-thunder');
    expect(resolveTeam('Golden State Warriors advance')).toBe('golden-state-warriors');
  });

  it('NBA_TEAMS exports all 30 teams', () => {
    expect(NBA_TEAMS).toHaveLength(30);
  });

  it('resolves unique team for each team id', () => {
    for (const team of NBA_TEAMS) {
      expect(resolveTeam(team.fullName)).toBe(team.id);
    }
  });
});
