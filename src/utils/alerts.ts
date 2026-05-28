import axios from 'axios';
import { env } from '../env.js';

export type AlertLevel = 'INFO' | 'WARN' | 'ERROR' | 'TRADE';

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  metadata?: Record<string, string | number>;
}

export function formatDiscordEmbed(payload: AlertPayload): object {
  const colors: Record<AlertLevel, number> = {
    INFO: 0x3498db,
    WARN: 0xf39c12,
    ERROR: 0xe74c3c,
    TRADE: 0x2ecc71,
  };
  const fields = payload.metadata
    ? Object.entries(payload.metadata).map(([name, value]) => ({
        name, value: String(value), inline: true,
      }))
    : [];
  return {
    embeds: [{
      title: payload.title,
      description: payload.message,
      color: colors[payload.level],
      fields,
      timestamp: new Date().toISOString(),
    }],
  };
}

export async function sendDiscord(payload: AlertPayload): Promise<void> {
  const url = env.discordWebhookUrl;
  if (!url) return;
  try {
    await axios.post(url, formatDiscordEmbed(payload));
  } catch (err) {
    console.error('[ALERTS] Discord send failed:', err);
  }
}

export async function sendTelegram(payload: AlertPayload): Promise<void> {
  const token = env.telegramBotToken;
  const chatId = env.telegramChatId;
  if (!token || !chatId) return;
  const icon: Record<AlertLevel, string> = { INFO: 'ℹ️', WARN: '⚠️', ERROR: '🚨', TRADE: '💰' };
  const text = `${icon[payload.level]} *${payload.title}*\n${payload.message}`;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('[ALERTS] Telegram send failed:', err);
  }
}

export async function alert(payload: AlertPayload): Promise<void> {
  await Promise.allSettled([sendDiscord(payload), sendTelegram(payload)]);
}

// Convenience helpers
export const alerts = {
  trade: (title: string, message: string, metadata?: Record<string, string | number>) =>
    alert({ level: 'TRADE', title, message, metadata }),
  error: (title: string, message: string) =>
    alert({ level: 'ERROR', title, message }),
  warn: (title: string, message: string) =>
    alert({ level: 'WARN', title, message }),
  info: (title: string, message: string) =>
    alert({ level: 'INFO', title, message }),
};
