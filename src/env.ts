import { config } from 'dotenv';
import { TradingMode } from './types.js';

config();

export function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const n = Number(val);
  if (isNaN(n)) throw new Error(`Env var ${key} must be a number, got: ${val}`);
  return n;
}

/** Read trading mode lazily so CLI --mode flag works even after module init */
export function getMode(): TradingMode {
  return (process.env['TRADING_MODE'] as TradingMode) || 'dry-run';
}

/** Read kill switch lazily */
export function getKillSwitch(): boolean {
  return process.env['KILL_SWITCH'] === 'true';
}

export const env = {
  // Wallet (only required for live mode)
  walletPrivateKey: process.env['WALLET_PRIVATE_KEY'],
  walletAddress: process.env['WALLET_ADDRESS'],

  // Trading mode
  tradingMode: optional('TRADING_MODE', 'dry-run') as TradingMode,

  // Risk parameters
  maxDailyLossUsdc: optionalNumber('MAX_DAILY_LOSS_USDC', 50),
  maxPortfolioExposureUsdc: optionalNumber('MAX_PORTFOLIO_EXPOSURE_USDC', 100),
  maxSingleTeamExposureUsdc: optionalNumber('MAX_SINGLE_TEAM_EXPOSURE_USDC', 30),
  kellyFraction: optionalNumber('KELLY_FRACTION', 0.1),
  maxBetUsdc: optionalNumber('MAX_BET_USDC', 10),
  minEvThreshold: optionalNumber('MIN_EV_THRESHOLD', 0.08),
  minConfidence: optionalNumber('MIN_CONFIDENCE', 0.45),
  minLiquidityUsd: optionalNumber('MIN_LIQUIDITY_USD', 1000),
  minVolume24hUsd: optionalNumber('MIN_VOLUME_24H_USD', 50000),

  // Polling intervals
  injuryPollMs: optionalNumber('INJURY_POLL_MS', 60_000),
  marketPollMs: optionalNumber('MARKET_POLL_MS', 30_000),

  // API endpoints
  polymarketClobUrl: optional('POLYMARKET_CLOB_URL', 'https://clob.polymarket.com'),
  polymarketGammaUrl: optional('POLYMARKET_GAMMA_URL', 'https://gamma-api.polymarket.com'),
  espnNbaUrl: optional('ESPN_NBA_URL', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'),

  // Logging
  logDir: optional('LOG_DIR', '.canon/execution'),

  // Kill switch
  killSwitch: process.env['KILL_SWITCH'] === 'true',

  // Alert destinations (optional)
  discordWebhookUrl: process.env['DISCORD_WEBHOOK_URL'] || '',
  telegramBotToken: process.env['TELEGRAM_BOT_TOKEN'] || '',
  telegramChatId: process.env['TELEGRAM_CHAT_ID'] || '',
} as const;

export function validateEnv(): void {
  const mode = getMode();
  if (!['scan', 'dry-run', 'live'].includes(mode)) {
    throw new Error(`Invalid TRADING_MODE: "${mode}". Must be scan, dry-run, or live.`);
  }
  if (mode === 'live') {
    if (!process.env['WALLET_PRIVATE_KEY']) throw new Error('WALLET_PRIVATE_KEY required for live trading');
    if (!process.env['WALLET_ADDRESS']) throw new Error('WALLET_ADDRESS required for live trading');
  }
}

export function requireLiveCredentials(): void {
  if (!env.walletPrivateKey) throw new Error('WALLET_PRIVATE_KEY required for live trading');
  if (!env.walletAddress) throw new Error('WALLET_ADDRESS required for live trading');
}
