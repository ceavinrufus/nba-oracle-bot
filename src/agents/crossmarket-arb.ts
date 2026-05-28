import { Market, ArbSignal } from '../types.js';

/**
 * Cross-Market Arb Detection
 *
 * Core thesis: Polymarket runs correlated markets that can be mathematically
 * inconsistent with each other.
 *
 * Example:
 *   "OKC wins series" = 0.65 implied prob
 *   "OKC wins next game" in a must-win context = 0.48 implied prob
 *   → If OKC must win this game to stay alive, game win prob should be ≥ series win prob
 *   → 0.48 < 0.65 = inconsistency → buy "OKC wins next game"
 *
 * Also detects: complementary market mispricing (YES + NO prices should sum to ~1.0)
 */

const COMPLEMENT_GAP_THRESHOLD = 0.03; // YES + NO should sum to 1.0 ± 3%
const ARB_GAP_THRESHOLD = 0.05;        // 5% gap to signal

export function detectComplementaryArb(markets: Market[]): ArbSignal[] {
  const signals: ArbSignal[] = [];

  for (const market of markets) {
    if (market.outcomes.length !== 2) continue;
    if (market.liquidity < 1000) continue;

    const [yes, no] = market.outcomes;
    if (!yes || !no) continue;

    const sum = yes.price + no.price;
    const gap = Math.abs(1.0 - sum);

    if (gap > COMPLEMENT_GAP_THRESHOLD) {
      // The cheaper side is mispriced — buy it
      const mispriced = yes.price < no.price ? yes : no;
      const fair = 1 - (yes.price < no.price ? no.price : yes.price);

      signals.push({
        type: 'ARB',
        description: `Complementary mispricing: YES(${yes.price.toFixed(3)}) + NO(${no.price.toFixed(3)}) = ${sum.toFixed(3)} (gap: ${(gap * 100).toFixed(1)}%)`,
        marketA: { marketId: market.marketId, outcome: mispriced.outcome, price: mispriced.price },
        marketB: { marketId: market.marketId, outcome: mispriced.outcome === 'Yes' ? 'No' : 'Yes', price: 1 - mispriced.price },
        impliedProb: mispriced.price,
        actualProb: fair,
        gapSize: gap,
        detectedAt: Date.now(),
      });
    }
  }

  return signals;
}

export function detectSeriesGameInconsistency(markets: Market[]): ArbSignal[] {
  const signals: ArbSignal[] = [];

  // Group markets by team mentions
  const seriesMarkets = markets.filter(m =>
    m.question.toLowerCase().includes('series') ||
    m.question.toLowerCase().includes('advance')
  );
  const gameMarkets = markets.filter(m =>
    m.question.toLowerCase().includes('game') ||
    m.question.toLowerCase().includes('win tonight') ||
    m.question.toLowerCase().includes('moneyline')
  );

  for (const seriesMarket of seriesMarkets) {
    for (const outcome of seriesMarket.outcomes) {
      const teamName = outcome.outcome.toLowerCase();
      const seriesWinProb = outcome.price;
      if (seriesWinProb < 0.1 || seriesWinProb > 0.9) continue; // skip near-certainties

      // Find game market for same team
      for (const gameMarket of gameMarkets) {
        const gameOutcome = gameMarket.outcomes.find(o =>
          o.outcome.toLowerCase().includes(teamName) ||
          teamName.includes(o.outcome.toLowerCase())
        );
        if (!gameOutcome) continue;

        const gameWinProb = gameOutcome.price;
        const gap = Math.abs(seriesWinProb - gameWinProb);

        if (gap > ARB_GAP_THRESHOLD) {
          const mispriced = seriesWinProb > gameWinProb ? gameOutcome : outcome;
          const anchor = seriesWinProb > gameWinProb ? outcome : gameOutcome;

          signals.push({
            type: 'ARB',
            description: `Series/game inconsistency for ${outcome.outcome}: series=${seriesWinProb.toFixed(3)} game=${gameWinProb.toFixed(3)} gap=${(gap * 100).toFixed(1)}%`,
            marketA: {
              marketId: seriesWinProb > gameWinProb ? gameMarket.marketId : seriesMarket.marketId,
              outcome: mispriced.outcome,
              price: mispriced.price,
            },
            marketB: {
              marketId: seriesWinProb > gameWinProb ? seriesMarket.marketId : gameMarket.marketId,
              outcome: anchor.outcome,
              price: anchor.price,
            },
            impliedProb: mispriced.price,
            actualProb: anchor.price,
            gapSize: gap,
            detectedAt: Date.now(),
          });
        }
      }
    }
  }

  return signals;
}

export async function scanCrossMarketArb(markets: Market[]): Promise<ArbSignal[]> {
  const complementarySignals = detectComplementaryArb(markets);
  const seriesGameSignals = detectSeriesGameInconsistency(markets);
  return [...complementarySignals, ...seriesGameSignals];
}
