import { readFile } from 'fs/promises';

const DEFAULT_BOT_TOKEN_FILE = '/var/lib/nex/runtime/public/nexaccount/nexai-storage-bot-token';
const DEFAULT_CHAT_ID_FILE = '/var/lib/nex/runtime/public/nexaccount/nexai-storage-chat-id';
const DEFAULT_API_BASE = 'https://api.telegram.org';
const DEFAULT_EXPECTED_BOT_USERNAME = 'NexAiStorage_bot';
const PUBLIC_BOT_API_DOWNLOAD_LIMIT = 20 * 1024 * 1024;
const KNOWME_MEDIA_LIMIT = 25 * 1024 * 1024;

type TelegramConfig = {
  token: string;
  chatId: string;
  expectedBotUsername: string;
  apiBase: URL;
  timeoutMs: number;
  maxBytes: number;
};

type StoredTelegramReference = {
  v: 1;
  messageId: number;
  fileId: string;
  size: number;
};

export class TelegramMediaStorage {
  private config: TelegramConfig | null = null;

  async init() {
    const config = await this.getConfig();
    const me = await this.botApi('getMe');
    const username = String(me?.username || '').trim().replace(/^@/, '');
    if (
      config.expectedBotUsername &&
      username.toLowerCase() !== config.expectedBotUsername.toLowerCase()
    ) {
      throw new Error('Configured Telegram media token does not belong to the expected storage bot.');
    }

    const chat = await this.botApi('getChat', { chat_id: config.chatId });
    if (chat?.type !== 'channel') {
      throw new Error('Configured Telegram media storage target is not a channel.');
    }

    const administrators = await this.botApi('getChatAdministrators', { chat_id: String(chat.id) });
    const isAdministrator =
      Array.isArray(administrators) &&
      administrators.some(
        (row) =>
          String(row?.user?.id || '') === String(me?.id || '') &&
          ['administrator', 'creator'].includes(String(row?.status || ''))
      );

    if (!isAdministrator) {
      throw new Error('Telegram media storage bot must be an administrator of the storage channel.');
    }

    config.chatId = String(chat.id);
  }

  async put(key: string, body: Buffer, contentType: string) {
    const config = await this.getConfig();
    if (!body.length) throw new Error('Telegram media storage refuses empty objects.');
    if (body.length > config.maxBytes) {
      throw new Error('Telegram media object exceeds the configured safe download limit.');
    }

    const form = new FormData();
    form.append('chat_id', config.chatId);
    form.append('document', new Blob([body], { type: contentType || 'application/octet-stream' }), key);
    form.append('disable_notification', 'true');
    form.append('protect_content', 'true');
    form.append('caption', 'KnowMe private media');

    const message = await this.botApi('sendDocument', form, Math.max(config.timeoutMs, 60_000));
    const stored = message?.document ?? message?.video ?? message?.audio ?? message?.animation ?? null;
    const fileId = String(stored?.file_id || '');
    const messageId = Number(message?.message_id || 0);

    if (!fileId || !Number.isSafeInteger(messageId) || messageId <= 0) {
      if (messageId > 0) {
        await this.deleteMessage(messageId).catch(() => undefined);
      }
      throw new Error('Telegram did not return a reusable storage reference.');
    }

    return this.encodeReference({
      v: 1,
      messageId,
      fileId,
      size: Number(stored?.file_size || body.length)
    });
  }

  async get(storageKey: string) {
    const config = await this.getConfig();
    const stored = this.decodeReference(storageKey);
    const info = await this.botApi('getFile', { file_id: stored.fileId });
    const fileSize = Number(info?.file_size || stored.size || 0);
    if (fileSize > config.maxBytes) {
      throw new Error('Telegram media object exceeds the configured safe download limit.');
    }

    const filePath = String(info?.file_path || '');
    if (!filePath) throw new Error('Telegram did not return a file path for the stored media.');

    const url = this.fileUrl(config, filePath);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (!response.ok) {
      throw new Error(`Telegram media download failed with HTTP ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('Telegram media download returned an empty object.');
    if (buffer.length > config.maxBytes) {
      throw new Error('Telegram media object exceeds the configured safe download limit.');
    }
    return buffer;
  }

  async delete(storageKey: string) {
    const stored = this.decodeReference(storageKey);
    await this.deleteMessage(stored.messageId);
  }

  private async deleteMessage(messageId: number) {
    const config = await this.getConfig();
    const response = await this.rawBotApi('deleteMessage', {
      chat_id: config.chatId,
      message_id: messageId
    });

    if (response.ok && response.data?.ok === true) return;

    const description = String(response.data?.description || '');
    if (
      response.status === 400 &&
      /message to delete not found|message identifier is not specified/i.test(description)
    ) {
      return;
    }

    throw new Error(
      `Telegram media deletion failed with HTTP ${response.status || 500}.`
    );
  }

  private async botApi(method: string, payload: Record<string, unknown> | FormData = {}, timeoutMs?: number) {
    const response = await this.rawBotApi(method, payload, timeoutMs);
    if (!response.ok || response.data?.ok !== true) {
      throw new Error(
        `Telegram media storage ${method} failed with HTTP ${response.status || 500}.`
      );
    }
    return response.data.result;
  }

  private async rawBotApi(
    method: string,
    payload: Record<string, unknown> | FormData = {},
    timeoutMs?: number
  ) {
    const config = await this.getConfig();
    const isForm = payload instanceof FormData;
    const endpoint = new URL(`bot${config.token}/${method}`, this.ensureTrailingSlash(config.apiBase));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: isForm ? undefined : { 'content-type': 'application/json' },
      body: isForm ? payload : JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs ?? config.timeoutMs)
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  }

  private async getConfig() {
    if (this.config) return this.config;

    const token = await this.readConfiguredValue(
      'MEDIA_TELEGRAM_BOT_TOKEN',
      'NEXAI_STORAGE_BOT_TOKEN',
      'MEDIA_TELEGRAM_BOT_TOKEN_FILE',
      'NEXAI_STORAGE_BOT_TOKEN_FILE',
      DEFAULT_BOT_TOKEN_FILE
    );
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
      throw new Error('Telegram media storage bot token is missing or invalid.');
    }

    const chatId = await this.readConfiguredValue(
      'MEDIA_TELEGRAM_CHAT_ID',
      'NEXAI_STORAGE_CHAT_ID',
      'MEDIA_TELEGRAM_CHAT_ID_FILE',
      'NEXAI_STORAGE_CHAT_ID_FILE',
      DEFAULT_CHAT_ID_FILE
    );
    if (!/^-?\d+$/.test(chatId) && !/^@[A-Za-z0-9_]{5,}$/.test(chatId)) {
      throw new Error('Telegram media storage channel identifier is missing or invalid.');
    }

    const apiBase = new URL(process.env.MEDIA_TELEGRAM_API_BASE_URL?.trim() || DEFAULT_API_BASE);
    if (!['http:', 'https:'].includes(apiBase.protocol)) {
      throw new Error('MEDIA_TELEGRAM_API_BASE_URL must use HTTP or HTTPS.');
    }
    if (apiBase.username || apiBase.password || apiBase.search || apiBase.hash) {
      throw new Error('MEDIA_TELEGRAM_API_BASE_URL must not contain credentials, query parameters or fragments.');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      apiBase.protocol !== 'https:' &&
      !['127.0.0.1', 'localhost', '::1'].includes(apiBase.hostname)
    ) {
      throw new Error('MEDIA_TELEGRAM_API_BASE_URL must use HTTPS in production unless it is loopback.');
    }

    const timeoutMs = this.parseBoundedInteger(
      process.env.MEDIA_TELEGRAM_TIMEOUT_MS,
      30_000,
      1_000,
      120_000,
      'MEDIA_TELEGRAM_TIMEOUT_MS'
    );
    const publicApi = apiBase.hostname === 'api.telegram.org';
    const maxUpperBound = publicApi ? PUBLIC_BOT_API_DOWNLOAD_LIMIT : KNOWME_MEDIA_LIMIT;
    const maxBytes = this.parseBoundedInteger(
      process.env.MEDIA_TELEGRAM_MAX_BYTES,
      Math.min(PUBLIC_BOT_API_DOWNLOAD_LIMIT, maxUpperBound),
      1024 * 1024,
      maxUpperBound,
      'MEDIA_TELEGRAM_MAX_BYTES'
    );

    this.config = {
      token,
      chatId,
      expectedBotUsername: String(
        process.env.MEDIA_TELEGRAM_EXPECTED_BOT_USERNAME ||
          process.env.NEXAI_STORAGE_BOT_USERNAME ||
          DEFAULT_EXPECTED_BOT_USERNAME
      )
        .trim()
        .replace(/^@/, ''),
      apiBase,
      timeoutMs,
      maxBytes
    };
    return this.config;
  }

  private async readConfiguredValue(
    primaryEnv: string,
    legacyEnv: string,
    primaryFileEnv: string,
    legacyFileEnv: string,
    defaultFile: string
  ) {
    const direct = String(process.env[primaryEnv] || process.env[legacyEnv] || '').trim();
    if (direct) return direct;

    const path = String(
      process.env[primaryFileEnv] || process.env[legacyFileEnv] || defaultFile
    ).trim();
    try {
      return String(await readFile(path, 'utf8')).trim();
    } catch {
      return '';
    }
  }

  private encodeReference(reference: StoredTelegramReference) {
    return `tg.${Buffer.from(JSON.stringify(reference), 'utf8').toString('base64url')}`;
  }

  private decodeReference(value: string): StoredTelegramReference {
    if (!value.startsWith('tg.')) throw new Error('Invalid Telegram media storage key.');
    try {
      const decoded = JSON.parse(Buffer.from(value.slice(3), 'base64url').toString('utf8'));
      const messageId = Number(decoded?.messageId || 0);
      const fileId = String(decoded?.fileId || '');
      const size = Number(decoded?.size || 0);
      if (
        decoded?.v !== 1 ||
        !Number.isSafeInteger(messageId) ||
        messageId <= 0 ||
        !/^[A-Za-z0-9_-]{10,1024}$/.test(fileId) ||
        !Number.isSafeInteger(size) ||
        size < 0
      ) {
        throw new Error('invalid');
      }
      return { v: 1, messageId, fileId, size };
    } catch {
      throw new Error('Invalid Telegram media storage key.');
    }
  }

  private fileUrl(config: TelegramConfig, filePath: string) {
    const safePath = filePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return new URL(
      `file/bot${config.token}/${safePath}`,
      this.ensureTrailingSlash(config.apiBase)
    );
  }

  private ensureTrailingSlash(url: URL) {
    const value = new URL(url.toString());
    if (!value.pathname.endsWith('/')) value.pathname += '/';
    return value;
  }

  private parseBoundedInteger(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
    name: string
  ) {
    if (!value?.trim()) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    }
    return parsed;
  }
}
