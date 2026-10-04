import { TelegramMediaStorage } from './telegram-media-storage';

const ORIGINAL_ENV = { ...process.env };

function configureTelegram() {
  process.env.NODE_ENV = 'production';
  process.env.MEDIA_TELEGRAM_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghi';
  process.env.MEDIA_TELEGRAM_CHAT_ID = '-1001234567890';
  process.env.MEDIA_TELEGRAM_EXPECTED_BOT_USERNAME = 'NexAiStorage_bot';
  process.env.MEDIA_TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
  process.env.MEDIA_TELEGRAM_TIMEOUT_MS = '30000';
  process.env.MEDIA_TELEGRAM_MAX_BYTES = String(20 * 1024 * 1024);
}

function telegramJson(result: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status >= 200 && status < 300, result }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('TelegramMediaStorage', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('verifies the existing storage bot/channel and round-trips an opaque Telegram reference', async () => {
    configureTelegram();
    const storedFileId = 'BQACAgQAAxkBAAExampleFileId_1234567890';
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/getMe')) {
        return telegramJson({ id: 999, username: 'NexAiStorage_bot' });
      }
      if (url.endsWith('/getChat')) {
        return telegramJson({ id: -1001234567890, type: 'channel', title: 'NexAI Storage' });
      }
      if (url.endsWith('/getChatAdministrators')) {
        return telegramJson([{ status: 'administrator', user: { id: 999 } }]);
      }
      if (url.endsWith('/sendDocument')) {
        return telegramJson({
          message_id: 88,
          document: { file_id: storedFileId, file_size: 4 }
        });
      }
      if (url.endsWith('/getFile')) {
        return telegramJson({
          file_id: storedFileId,
          file_size: 4,
          file_path: 'documents/file_1.bin'
        });
      }
      if (url.includes('/file/bot') && url.endsWith('/documents/file_1.bin')) {
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      }
      if (url.endsWith('/deleteMessage')) {
        return telegramJson(true);
      }
      throw new Error('Unexpected fetch URL: ' + url);
    });

    const storage = new TelegramMediaStorage();
    await storage.init();
    const key = await storage.put('asset.mp4', Buffer.from([1, 2, 3, 4]), 'video/mp4');

    expect(key).toMatch(/^tg\.[A-Za-z0-9_-]+$/);
    expect(key).not.toContain(process.env.MEDIA_TELEGRAM_BOT_TOKEN!);
    expect(key).not.toContain(process.env.MEDIA_TELEGRAM_CHAT_ID!);
    await expect(storage.get(key)).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('fails closed when the configured token is not the current NexAI Storage bot', async () => {
    configureTelegram();
    jest.spyOn(global, 'fetch').mockResolvedValue(
      telegramJson({ id: 999, username: 'AnotherStorageBot' })
    );

    const storage = new TelegramMediaStorage();
    await expect(storage.init()).rejects.toThrow('expected storage bot');
  });

  it('refuses public Bot API objects above the safe getFile limit', async () => {
    configureTelegram();
    process.env.MEDIA_TELEGRAM_MAX_BYTES = String(20 * 1024 * 1024 + 1);
    const storage = new TelegramMediaStorage();

    await expect(storage.init()).rejects.toThrow('MEDIA_TELEGRAM_MAX_BYTES');
  });
});
