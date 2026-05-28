import { Position, getOpenPositions, PositionStore } from './tracker.js';

export interface ExposureByTeam {
  team: string;
  totalSize: number;
  positionCount: number;
}

export interface ExposureByMarketType {
  marketType: string;
  totalSize: number;
  positionCount: number;
}

export interface ExposureSummary {
  totalExposure: number;
  positionCount: number;
  byTeam: ExposureByTeam[];
  byMarketType: ExposureByMarketType[];
}

/**
 * Extract team name from tokenId or position metadata.
 * Convention: tokenId contains team abbreviation after last dash, e.g. "0x...abc-OKC"
 * Falls back to "unknown" if no pattern matches.
 */
export function extractTeam(tokenId: string): string {
  const parts = tokenId.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
}

/**
 * Extract market type from tokenId.
 * Convention: second segment indicates type, e.g. "series-moneyline-OKC"
 * Falls back to "general".
 */
export function extractMarketType(tokenId: string): string {
  const parts = tokenId.split('-');
  return parts.length > 2 ? parts[1] : 'general';
}

/**
 * Calculate portfolio exposure grouped by team.
 */
export function exposureByTeam(store: PositionStore): ExposureByTeam[] {
  const open = getOpenPositions(store);
  const map = new Map<string, { totalSize: number; positionCount: number }>();

  for (const pos of open) {
    const team = extractTeam(pos.tokenId);
    const entry = map.get(team) ?? { totalSize: 0, positionCount: 0 };
    entry.totalSize += pos.size;
    entry.positionCount += 1;
    map.set(team, entry);
  }

  return Array.from(map.entries()).map(([team, data]) => ({ team, ...data }));
}

/**
 * Calculate portfolio exposure grouped by market type.
 */
export function exposureByMarketType(store: PositionStore): ExposureByMarketType[] {
  const open = getOpenPositions(store);
  const map = new Map<string, { totalSize: number; positionCount: number }>();

  for (const pos of open) {
    const marketType = extractMarketType(pos.tokenId);
    const entry = map.get(marketType) ?? { totalSize: 0, positionCount: 0 };
    entry.totalSize += pos.size;
    entry.positionCount += 1;
    map.set(marketType, entry);
  }

  return Array.from(map.entries()).map(([marketType, data]) => ({ marketType, ...data }));
}

/**
 * Full exposure summary.
 */
export function exposureSummary(store: PositionStore): ExposureSummary {
  const open = getOpenPositions(store);
  return {
    totalExposure: open.reduce((sum, p) => sum + p.size, 0),
    positionCount: open.length,
    byTeam: exposureByTeam(store),
    byMarketType: exposureByMarketType(store),
  };
}
