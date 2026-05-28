import { fetchInjuryReports } from '../data/espn.js';
import { fetchNbaMarkets } from '../data/polymarket.js';
import { InjuryReport, InjurySignal } from '../types.js';

// Track previously seen injury statuses to detect changes
const seenInjuries = new Map<string, InjuryReport['status']>();

const STAR_PLAYER_KEYWORDS = [
  'lebron', 'curry', 'durant', 'giannis', 'jokic', 'embiid',
  'luka', 'tatum', 'mitchell', 'sga', 'gilgeous', 'brunson',
];

function isStarPlayer(playerName: string): boolean {
  const lower = playerName.toLowerCase();
  return STAR_PLAYER_KEYWORDS.some(k => lower.includes(k));
}

function estimatePriceMoveForStatus(status: InjuryReport['status']): number {
  switch (status) {
    case 'OUT': return 0.12;
    case 'DOUBTFUL': return 0.07;
    case 'QUESTIONABLE': return 0.04;
    default: return 0.01;
  }
}

export async function scanInjuries(): Promise<InjurySignal[]> {
  const [injuries, markets] = await Promise.all([
    fetchInjuryReports(),
    fetchNbaMarkets(),
  ]);

  const signals: InjurySignal[] = [];

  for (const injury of injuries) {
    const prevStatus = seenInjuries.get(injury.playerId);
    const isNew = prevStatus === undefined;
    const isWorsened =
      prevStatus === 'ACTIVE' && injury.status !== 'ACTIVE' ||
      prevStatus === 'PROBABLE' && ['OUT', 'DOUBTFUL', 'QUESTIONABLE'].includes(injury.status) ||
      prevStatus === 'QUESTIONABLE' && ['OUT', 'DOUBTFUL'].includes(injury.status) ||
      prevStatus === 'DOUBTFUL' && injury.status === 'OUT';

    seenInjuries.set(injury.playerId, injury.status);

    if (!isStarPlayer(injury.playerName)) continue;
    if (!isNew && !isWorsened) continue;
    if (!['OUT', 'DOUBTFUL', 'QUESTIONABLE'].includes(injury.status)) continue;

    // Find affected markets (markets mentioning the team)
    const affectedMarkets = markets
      .filter(m => m.question.toLowerCase().includes(injury.teamId.toLowerCase()))
      .map(m => m.marketId);

    signals.push({
      type: 'INJURY',
      injury,
      affectedMarkets,
      priceMoveEstimate: estimatePriceMoveForStatus(injury.status),
      urgency: injury.status === 'OUT' ? 'HIGH' : injury.status === 'DOUBTFUL' ? 'MEDIUM' : 'LOW',
      detectedAt: Date.now(),
    });
  }

  return signals;
}
