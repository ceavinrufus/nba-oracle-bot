import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alert, alerts, formatDiscordEmbed, sendDiscord, sendTelegram, AlertPayload } from '../src/utils/alerts.js';

// Mock axios
vi.mock('axios', () => {
  const post = vi.fn().mockResolvedValue({ data: {} });
  return { default: { post, create: () => ({ post }) } };
});

// Mock env module
vi.mock('../src/env.js', () => ({
  env: {
    discordWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
  },
}));

import axios from 'axios';
import { env } from '../src/env.js';

const envMutable = env as unknown as Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  envMutable.discordWebhookUrl = '';
  envMutable.telegramBotToken = '';
  envMutable.telegramChatId = '';
});

const basePayload: AlertPayload = {
  level: 'INFO',
  title: 'Test',
  message: 'Test message',
};

describe('alerts', () => {
  it('sends to Discord when webhook URL is set', async () => {
    envMutable.discordWebhookUrl = 'https://discord.com/api/webhooks/test';
    await sendDiscord(basePayload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });

  it('skips Discord when no webhook URL', async () => {
    await sendDiscord(basePayload);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('sends to Telegram when token and chatId are set', async () => {
    envMutable.telegramBotToken = 'bot123';
    envMutable.telegramChatId = '456';
    await sendTelegram(basePayload);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot123/sendMessage',
      expect.objectContaining({ chat_id: '456', parse_mode: 'Markdown' })
    );
  });

  it('skips Telegram when missing credentials', async () => {
    await sendTelegram(basePayload);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('formatDiscordEmbed produces correct color per level', () => {
    const colors: Record<string, number> = {
      INFO: 0x3498db,
      WARN: 0xf39c12,
      ERROR: 0xe74c3c,
      TRADE: 0x2ecc71,
    };
    for (const [level, color] of Object.entries(colors)) {
      const embed = formatDiscordEmbed({ ...basePayload, level: level as AlertPayload['level'] }) as {
        embeds: Array<{ color: number }>;
      };
      expect(embed.embeds[0].color).toBe(color);
    }
  });

  it('alerts.trade sends with level TRADE', async () => {
    envMutable.discordWebhookUrl = 'https://discord.com/api/webhooks/test';
    await alerts.trade('Trade Title', 'Trade happened', { size: 10 });
    expect(axios.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({ color: 0x2ecc71 }),
        ]),
      })
    );
  });

  it('alert calls both Discord and Telegram simultaneously', async () => {
    envMutable.discordWebhookUrl = 'https://discord.com/api/webhooks/test';
    envMutable.telegramBotToken = 'botabc';
    envMutable.telegramChatId = '789';
    await alert({ level: 'WARN', title: 'Warn', message: 'Watch out' });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
