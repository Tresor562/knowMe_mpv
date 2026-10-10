import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
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
  recoveryChatId?: string;
  expectedBotUsername: string;
  apiBase: URL;
  timeoutMs: number;
  maxBytes: number;
  encryptionKey: Buffer;
};

type TelegramMessageReference = { messageId: number; fileId: string };

type StoredTelegramReference = {
  v: 1;
  messageId: number;
  fileId: string;
  size: number;
  iv: string;
  tag: string;
};

type ReplicatedTelegramReference = {
  v: 2;
  primary: TelegramMessageReference;
  recovery: TelegramMessageReference;
  size: number;
  iv: string;
  tag: string;
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

    config.chatId = await this.validateChannel(config.chatId, me?.id, 'primary');
    if (config.recoveryChatId) {
      config.recoveryChatId = await this.validateChannel(config.recoveryChatId, me?.id, 'recovery');
      if (config.recoveryChatId === config.chatId) {
        throw new Error('Telegram primary and recovery storage channels must be distinct.');
      }
    }
  }

  private async validateChannel(chatId: string, botId: unknown, role: string) {
    const chat = await this.botApi('getChat', { chat_id: chatId });
    if (chat?.type !== 'channel') {
      throw new Error(`Telegram ${role} media storage target is not a channel.`);
    }

    const administrators = await this.botApi('getChatAdministrators', { chat_id: String(chat.id) });
    const administrator = Array.isArray(administrators)
      ? administrators.find((row) =>
        String(row?.user?.id || '') === String(botId || '') &&
        ['administrator', 'creator'].includes(String(row?.status || ''))
      ) : null;
    if (!administrator || (administrator.status === 'administrator' && administrator.can_post_messages === false)) {
      throw new Error(`Telegram media storage bot must be allowed to post in the ${role} channel.`);
    }
    return String(chat.id);
  }

  async put(key: string, body: Buffer, contentType: string) {
    const config = await this.getConfig();
    if (!body.length) throw new Error('Telegram media storage refuses empty objects.');
    if (body.length > config.maxBytes) {
      throw new Error('Telegram media object exceeds the configured safe download limit.');
    }

    // Same authenticated ciphertext is written to two distinct private channels.
    const encrypted = this.encrypt(body, config.encryptionKey);
    const iv = encrypted.iv.toString('base64url');
    const tag = encrypted.tag.toString('base64url');
    const primary = await this.uploadEncrypted(config.chatId, key, encrypted.body, config.timeoutMs);
    if (!config.recoveryChatId) {
      return this.encodeReference({ v: 1, ...primary, size: body.length, iv, tag });
    }

    try {
      const recovery = await this.uploadEncrypted(
        config.recoveryChatId, key, encrypted.body, config.timeoutMs
      );
      return this.encodeReference({ v: 2, primary, recovery, size: body.length, iv, tag });
    } catch (error) {
      // A strict mirror policy avoids claiming a durable upload with no backup.
      await this.deleteMessage(primary.messageId, config.chatId).catch(() => undefined);
      throw error;
    }
  }

  private async uploadEncrypted(chatId: string, key: string, ciphertext: Buffer, timeoutMs: number) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', new Blob([new Uint8Array(ciphertext)], {
      type: 'application/octet-stream'
    }), key + '.enc');
    form.append('disable_notification', 'true');
    form.append('protect_content', 'true');
    form.append('caption', 'KnowMe encrypted media');

    const message = await this.botApi('sendDocument', form, Math.max(timeoutMs, 60_000));
    const stored = message?.document ?? null;
    const fileId = String(stored?.file_id || '');
    const messageId = Number(message?.message_id || 0);
    if (!fileId || !Number.isSafeInteger(messageId) || messageId <= 0) {
      if (messageId > 0) {
        await this.deleteMessage(messageId, chatId).catch(() => undefined);
      }
      throw new Error('Telegram did not return a reusable storage reference.');
    }
    return { messageId, fileId };
  }

  async get(storageKey: string) {
    const config = await this.getConfig();
    const stored = this.decodeReference(storageKey);
    const locations: TelegramMessageReference[] = stored.v === 2
      ? [stored.primary, stored.recovery]
      : [{ messageId: stored.messageId, fileId: stored.fileId }];

    for (const location of locations) {
      try {
        return await this.readEncrypted(location.fileId, stored, config);
      } catch {
        // A damaged or unavailable primary is recovered from the second channel.
      }
    }
    throw new Error('Telegram media unavailable or failed integrity validation in every storage channel.');
  }

  private async readEncrypted(
    fileId: string,
    stored: StoredTelegramReference | ReplicatedTelegramReference,
    config: TelegramConfig
  ) {
    const info = await this.botApi('getFile', { file_id: fileId });
    const fileSize = Number(info?.file_size || stored.size || 0);
    if (fileSize > config.maxBytes) {
      throw new Error('Telegram media object exceeds the configured safe download limit.');
    }
    const filePath = String(info?.file_path || '');
    if (!filePath) throw new Error('Telegram did not return a file path for the stored media.');
    const response = await fetch(this.fileUrl(config, filePath), {
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (!response.ok) throw new Error(`Telegram media download failed with HTTP ${response.status}.`);
    const encrypted = Buffer.from(await response.arrayBuffer());
    if (!encrypted.length || encrypted.length > config.maxBytes) {
      throw new Error('Telegram media download size is invalid.');
    }
    const plain = this.decrypt(
      encrypted, config.encryptionKey,
      Buffer.from(stored.iv, 'base64url'), Buffer.from(stored.tag, 'base64url')
    );
    if (plain.length !== stored.size) throw new Error('Telegram media size mismatch.');
    return plain;
  }

  async delete(storageKey: string) {
    const config = await this.getConfig();
    const stored = this.decodeReference(storageKey);
    if (stored.v === 1) {
      await this.deleteMessage(stored.messageId, config.chatId);
      return;
    }
    if (!config.recoveryChatId) {
      throw new Error('Cannot delete mirrored Telegram media without its recovery channel configured.');
    }
    // Both deletions are attempted, even if one channel fails. Metadata remains
    // intact if either deletion fails, allowing a safe retry.
    const results = await Promise.allSettled([
      this.deleteMessage(stored.primary.messageId, config.chatId),
      this.deleteMessage(stored.recovery.messageId, config.recoveryChatId)
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Could not delete Telegram media from both storage channels.');
    }
  }

  private async deleteMessage(messageId: number, chatId: string) {
    const response = await this.rawBotApi('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
    if (response.ok && response.data?.ok === true) return;
    const description = String(response.data?.description || '');
    if (
      response.status === 400 &&
      /message to delete not found|message identifier is not specified/i.test(description)
    ) return;
    throw new Error(`Telegram media deletion failed with HTTP ${response.status || 500}.`);
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
    const endpoint = new URL(`./bot${config.token}/${method}`, this.ensureTrailingSlash(config.apiBase));
    const attempts = 4;
    let lastNetworkError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: isForm ? undefined : { 'content-type': 'application/json' },
          body: isForm ? payload : JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs ?? config.timeoutMs)
        });
        const data = await response.json().catch(() => null);

        if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
          const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
          const retryDelayMs =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? Math.min(retryAfterSeconds * 1000, 5_000)
              : Math.min(500 * attempt, 2_000);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }

        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        lastNetworkError = error;
        if (attempt >= attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(500 * attempt, 2_000)));
      }
    }

    throw lastNetworkError instanceof Error
      ? lastNetworkError
      : new Error('Telegram media storage network request failed.');
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

    const recoveryChatId = String(process.env.MEDIA_TELEGRAM_RECOVERY_CHAT_ID || '').trim();
    if (recoveryChatId && !/^-?\\d+$/.test(recoveryChatId) && !/^@[A-Za-z0-9_]{5,}$/.test(recoveryChatId)) {
      throw new Error('MEDIA_TELEGRAM_RECOVERY_CHAT_ID must be a numeric channel ID or public username, not an invite link.');
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
      recoveryChatId: recoveryChatId || undefined,
      expectedBotUsername: String(
        process.env.MEDIA_TELEGRAM_EXPECTED_BOT_USERNAME ||
          process.env.NEXAI_STORAGE_BOT_USERNAME ||
          DEFAULT_EXPECTED_BOT_USERNAME
      )
        .trim()
        .replace(/^@/, ''),
      apiBase,
      timeoutMs,
      maxBytes,
      encryptionKey: this.resolveEncryptionKey()
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

  private encodeReference(reference: StoredTelegramReference | ReplicatedTelegramReference) {
    return `tg.${Buffer.from(JSON.stringify(reference), 'utf8').toString('base64url')}`;
  }

  private decodeReference(value: string): StoredTelegramReference | ReplicatedTelegramReference {
    if (!value.startsWith('tg.')) throw new Error('Invalid Telegram media storage key.');
    try {
      const decoded = JSON.parse(Buffer.from(value.slice(3), 'base64url').toString('utf8'));
      const validLocation = (entry: unknown): entry is TelegramMessageReference => {
        if (!entry || typeof entry !== 'object') return false;
        const ref = entry as Record<string, unknown>;
        return Number.isSafeInteger(ref.messageId) && Number(ref.messageId) > 0 &&
          typeof ref.fileId === 'string' && /^[A-Za-z0-9_-]{10,1024}$/.test(ref.fileId);
      };
      const commonValid =
        Number.isSafeInteger(decoded?.size) && decoded.size > 0 &&
        typeof decoded?.iv === 'string' && typeof decoded?.tag === 'string' &&
        Buffer.from(decoded.iv, 'base64url').length === 12 &&
        Buffer.from(decoded.tag, 'base64url').length === 16 &&
        /^[A-Za-z0-9_-]+$/.test(decoded.iv) && /^[A-Za-z0-9_-]+$/.test(decoded.tag);
      if (!commonValid) throw new Error('invalid');
      if (decoded.v === 1 && validLocation(decoded)) return decoded as StoredTelegramReference;
      if (decoded.v === 2 &&
          validLocation(decoded.primary) && validLocation(decoded.recovery)) {
        return decoded as ReplicatedTelegramReference;
      }
      throw new Error('invalid');
    } catch {
      throw new Error('Invalid Telegram media storage key.');
    }
  }

  private resolveEncryptionKey() {
    const dedicated = String(process.env.MEDIA_TELEGRAM_ENCRYPTION_KEY || '').trim();
    if (dedicated) {
      if (/^[a-fA-F0-9]{64}$/.test(dedicated)) return Buffer.from(dedicated, 'hex');
      try {
        const decoded = Buffer.from(dedicated, 'base64');
        if (decoded.length === 32) return decoded;
      } catch {
        // Fall through to a fixed configuration error.
      }
      throw new Error('MEDIA_TELEGRAM_ENCRYPTION_KEY must encode exactly 32 bytes.');
    }

    const root = String(process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY || '').trim();
    if (!root) {
      throw new Error('MEDIA_TELEGRAM_ENCRYPTION_KEY is required when Telegram media storage is enabled.');
    }
    return createHmac('sha256', root)
      .update('knowme:telegram-media-storage:v1')
      .digest();
  }

  private encrypt(body: Buffer, key: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
    return { body: encrypted, iv, tag: cipher.getAuthTag() };
  }

  private decrypt(body: Buffer, key: Buffer, iv: Buffer, tag: Buffer) {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
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
