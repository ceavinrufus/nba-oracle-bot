// ─── Market Data ────────────────────────────────────────────────────────────

export interface MarketOutcome {
  tokenId: string;
  outcome: string;        // e.g. "OKC Thunder"
  price: number;          // 0–1 implied probability
}

export interface Market {
  marketId: string;
  conditionId: string;
  question: string;
  outcomes: MarketOutcome[];
  liquidity: number;       // USD
  volume24h: number;       // USD
  closeTime: number;       // Unix timestamp
  active: boolean;
}

// ─── NBA Data ────────────────────────────────────────────────────────────────

export interface TeamStats {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  last10: { wins: number; losses: number };
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
}

export interface InjuryReport {
  playerId: string;
  playerName: string;
  teamId: string;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'ACTIVE';
  description: string;
  reportedAt: number;     // Unix timestamp ms
}

export interface SeriesState {
  seriesId: string;
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  homeWins: number;
  awayWins: number;
  currentGame: number;    // e.g. 5
  homeCourtTeam: string;  // teamId with home court advantage
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export interface InjurySignal {
  type: 'INJURY';
  injury: InjuryReport;
  affectedMarkets: string[];  // marketIds
  priceMoveEstimate: number;  // expected price delta (0–1)
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedAt: number;
}

export interface ArbSignal {
  type: 'ARB';
  description: string;
  marketA: { marketId: string; outcome: string; price: number };
  marketB: { marketId: string; outcome: string; price: number };
  impliedProb: number;
  actualProb: number;
  gapSize: number;        // absolute price gap
  detectedAt: number;
}

export interface EVSignal {
  type: 'EV';
  market: Market;
  outcome: MarketOutcome;
  modelProbability: number;
  impliedProbability: number;
  ev: number;             // expected value (positive = edge)
  confidence: number;     // 0–1
  detectedAt: number;
}

export type Signal = InjurySignal | ArbSignal | EVSignal;

// ─── Execution ───────────────────────────────────────────────────────────────

export type TradingMode = 'scan' | 'dry-run' | 'live';

export interface TradeDecision {
  signal: Signal;
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  sizeUsdc: number;
  reasoning: string;
}

export interface TradeResult {
  decision: TradeDecision;
  orderId?: string;
  status: 'filled' | 'pending' | 'rejected' | 'simulated' | 'skipped';
  fillPrice?: number;
  error?: string;
  executedAt: number;
}

// ─── Canon State ─────────────────────────────────────────────────────────────

export interface CanonState {
  phase: 'initializing' | 'scanning' | 'analyzing' | 'executing' | 'idle' | 'error';
  status: string;
  strategy: string;
  signals: {
    injury_scout: 'idle' | 'scanning' | 'signal_found' | 'error';
    crossmarket_arb: 'idle' | 'scanning' | 'signal_found' | 'error';
    series_probability: 'idle' | 'scanning' | 'signal_found' | 'error';
  };
  metrics: {
    scans: number;
    opportunities_found: number;
    trades_executed: number;
    pnl_usdc: number;
  };
  logs: string[];
}
