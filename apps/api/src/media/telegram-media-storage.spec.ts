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
  process.env.MEDIA_TELEGRAM_ENCRYPTION_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
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
    let uploadedBytes: Buffer | null = null;
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
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
        const form = init?.body as FormData;
        const document = form.get('document');
        if (!(document instanceof Blob)) throw new Error('Telegram document body missing');
        uploadedBytes = Buffer.from(await document.arrayBuffer());
        return telegramJson({
          message_id: 88,
          document: { file_id: storedFileId, file_size: uploadedBytes.length }
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
        if (!uploadedBytes) throw new Error('Encrypted upload bytes missing');
        return new Response(new Uint8Array(uploadedBytes), { status: 200 });
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
    expect(uploadedBytes).not.toBeNull();
    expect(uploadedBytes).not.toEqual(Buffer.from([1, 2, 3, 4]));
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

  it('mirrors encrypted payloads and falls back to recovery on a failed primary download', async () => {
    configureTelegram();
    process.env.MEDIA_TELEGRAM_RECOVERY_CHAT_ID = '-1002222222222';
    const saved: Record<string, Buffer> = {};
    const ids: Record<string, string> = {};
    const deleted: string[] = [];
    let nextId = 100;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/getMe')) return telegramJson({ id: 999, username: 'NexAiStorage_bot' });
      if (url.endsWith('/getChat')) {
        const chatId = String(JSON.parse(String(init?.body)).chat_id);
        return telegramJson({ id: Number(chatId), type: 'channel' });
      }
      if (url.endsWith('/getChatAdministrators')) {
        return telegramJson([{ status: 'administrator', user: { id: 999 }, can_post_messages: true }]);
      }
      if (url.endsWith('/sendDocument')) {
        const form = init?.body as FormData;
        const chatId = String(form.get('chat_id'));
        const document = form.get('document');
        if (!(document instanceof Blob)) throw new Error('Document expected');
        saved[chatId] = Buffer.from(await document.arrayBuffer());
        const fileId = chatId === '-1002222222222'
          ? 'BQACAgQAAxkBAARecoveryFileId_123456789'
          : 'BQACAgQAAxkBAAPrimaryFileId_1234567890';
        ids[fileId] = chatId;
        return telegramJson({ message_id: nextId++, document: { file_id: fileId } });
      }
      if (url.endsWith('/getFile')) {
        const id = String(JSON.parse(String(init?.body)).file_id);
        if (ids[id] === '-1001234567890') return telegramJson(null, 500);
        return telegramJson({ file_size: 4, file_path: 'documents/recovery.bin' });
      }
      if (url.includes('/file/bot') && url.endsWith('/documents/recovery.bin')) {
        return new Response(new Uint8Array(saved['-1002222222222']), { status: 200 });
      }
      if (url.endsWith('/deleteMessage')) {
        deleted.push(String(JSON.parse(String(init?.body)).chat_id));
        return telegramJson(true);
      }
      throw new Error('Unexpected request: ' + url);
    });

    const storage = new TelegramMediaStorage();
    await storage.init();
    const key = await storage.put('sample.png', Buffer.from([1, 2, 3, 4]), 'image/png');
    expect(key).toMatch(/^tg\.[A-Za-z0-9_-]+$/);
    expect(saved['-1001234567890']).toEqual(saved['-1002222222222']);
    expect(saved['-1001234567890']).not.toEqual(Buffer.from([1, 2, 3, 4]));
    await expect(storage.get(key)).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect(deleted.sort()).toEqual(['-1001234567890', '-1002222222222']);
  });

  it('rejects invite URLs instead of silently using them as channel IDs', async () => {
    configureTelegram();
    process.env.MEDIA_TELEGRAM_RECOVERY_CHAT_ID = 'https://t.me/+private';
    const storage = new TelegramMediaStorage();
    await expect(storage.init()).rejects.toThrow('not an invite link');
  });

  it('rejects an identical primary and recovery channel at startup', async () => {
    configureTelegram();
    process.env.MEDIA_TELEGRAM_RECOVERY_CHAT_ID = '-1001234567890';
    jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/getMe')) return telegramJson({ id: 999, username: 'NexAiStorage_bot' });
      if (url.endsWith('/getChat')) return telegramJson({ id: -1001234567890, type: 'channel' });
      if (url.endsWith('/getChatAdministrators')) {
        return telegramJson([{ status: 'administrator', user: { id: 999 }, can_post_messages: true }]);
      }
      throw new Error('Unexpected request');
    });
    const storage = new TelegramMediaStorage();
    await expect(storage.init()).rejects.toThrow('must be distinct');
  });
});
