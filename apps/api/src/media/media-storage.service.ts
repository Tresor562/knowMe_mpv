import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { mkdir, open, readFile, rm, stat, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { TelegramMediaStorage } from './telegram-media-storage';

export type MediaStorageDriver = 'local' | 's3' | 'telegram';
const MAX_STORAGE_RANGE_BYTES = 4 * 1024 * 1024;

type S3Config = {
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  timeoutMs: number;
  maxAttempts: number;
};

@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly localRoot = join(process.cwd(), 'private-media');
  private readonly driver = this.resolveDriver(process.env.MEDIA_STORAGE_DRIVER);
  private readonly s3 = this.driver === 's3' ? this.resolveS3Config(process.env) : null;
  private readonly telegram = this.driver === 'telegram' ? new TelegramMediaStorage() : null;

  async onModuleInit() {
    if (this.driver === 'local') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MEDIA_STORAGE_DRIVER=local is forbidden in production. Configure private S3-compatible object storage.');
      }
      await mkdir(this.localRoot, { recursive: true });
      return;
    }
    if (this.driver === 'telegram') {
      await this.telegram!.init();
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.assertSafeKey(key);
    if (this.driver === 'local') {
      await writeFile(this.localPath(key), body, { flag: 'wx' });
      return key;
    }
    if (this.driver === 'telegram') return this.telegram!.put(key, body, contentType);
    await this.s3Request('PUT', key, body, contentType);
    return key;
  }

  async get(key: string) {
    this.assertSafeKey(key);
    if (this.driver === 'local') return readFile(this.localPath(key));
    if (this.driver === 'telegram') return this.telegram!.get(key);
    const response = await this.s3Request('GET', key);
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Returns object size without fetching bytes for local/S3 drivers.
   * Telegram's legacy object adapter currently requires one full read.
   */
  async getSize(key: string): Promise<number> {
    this.assertSafeKey(key);
    if (this.driver === 'local') return (await stat(this.localPath(key))).size;
    if (this.driver === 'telegram') return (await this.telegram!.get(key)).length;
    const response = await this.s3Request('HEAD', key);
    const rawSize = response.headers.get('content-length');
    if (!rawSize || !/^(0|[1-9]\d*)$/.test(rawSize)) {
      throw new Error('Private object storage returned an invalid object length.');
    }
    const size = Number(rawSize);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error('Private object storage returned an invalid object length.');
    }
    return size;
  }

  /**
   * Strict, bounded byte-range reads. S3 signs the Range header so no
   * untrusted caller can bypass storage auth, local files use positioned I/O.
   * Telegram is a legacy fallback and still materializes the whole object.
   */
  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    this.assertSafeKey(key);
    const length = end - start + 1;
    if (
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end < start || length > MAX_STORAGE_RANGE_BYTES
    ) {
      throw new Error('Invalid private media storage byte range.');
    }
    if (this.driver === 'local') {
      const descriptor = await open(this.localPath(key), 'r');
      try {
        const buffer = Buffer.alloc(length);
        let read = 0;
        while (read < length) {
          const result = await descriptor.read(buffer, read, length - read, start + read);
          if (result.bytesRead <= 0) break;
          read += result.bytesRead;
        }
        if (read !== length) throw new Error('Incomplete local media range.');
        return buffer;
      } finally {
        await descriptor.close();
      }
    }
    if (this.driver === 'telegram') {
      const body = await this.telegram!.get(key);
      if (end >= body.length) throw new Error('Invalid Telegram media range.');
      return body.subarray(start, end + 1);
    }
    const response = await this.s3Request('GET', key, undefined, undefined, false,
      `bytes=${start}-${end}`);
    if (response.status !== 206) {
      throw new Error('Private object storage did not honor the requested byte range.');
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length !== length) throw new Error('Incomplete S3 media range.');
    return body;
  }

  async delete(key: string) {
    this.assertSafeKey(key);
    if (this.driver === 'local') {
      await rm(this.localPath(key), { force: true });
      return;
    }
    if (this.driver === 'telegram') {
      await this.telegram!.delete(key);
      return;
    }
    await this.s3Request('DELETE', key, undefined, undefined, true);
  }

  storageDriver() {
    return this.driver;
  }

  private resolveDriver(value: string | undefined): MediaStorageDriver {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return 'local';
    if (normalized === 'local' || normalized === 's3' || normalized === 'telegram') return normalized;
    throw new Error('MEDIA_STORAGE_DRIVER must be "local", "s3" or "telegram".');
  }

  private resolveS3Config(env: NodeJS.ProcessEnv): S3Config {
    const endpointRaw = env.MEDIA_S3_ENDPOINT?.trim();
    const bucket = env.MEDIA_S3_BUCKET?.trim();
    const region = env.MEDIA_S3_REGION?.trim();
    const accessKeyId = env.MEDIA_S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = env.MEDIA_S3_SECRET_ACCESS_KEY?.trim();
    if (!endpointRaw || !bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error('S3 media storage requires endpoint, bucket, region, access key ID and secret access key.');
    }
    const endpoint = new URL(endpointRaw);
    if (!['http:', 'https:'].includes(endpoint.protocol)) {
      throw new Error('MEDIA_S3_ENDPOINT must use HTTP or HTTPS.');
    }
    if (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') {
      throw new Error('MEDIA_S3_ENDPOINT must use HTTPS in production.');
    }
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error('MEDIA_S3_ENDPOINT must not contain credentials, query parameters or fragments.');
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(bucket)) {
      throw new Error('MEDIA_S3_BUCKET has an invalid bucket name.');
    }
    return {
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: env.MEDIA_S3_SESSION_TOKEN?.trim() || undefined,
      timeoutMs: this.parseBoundedInteger(env.MEDIA_S3_TIMEOUT_MS, 30_000, 1_000, 60_000, 'MEDIA_S3_TIMEOUT_MS'),
      maxAttempts: this.parseBoundedInteger(env.MEDIA_S3_MAX_ATTEMPTS, 3, 1, 5, 'MEDIA_S3_MAX_ATTEMPTS')
    };
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

  private async s3Request(
    method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
    key: string,
    body?: Buffer,
    contentType?: string,
    allowNotFound = false,
    range?: string
  ) {
    if (!this.s3) throw new Error('S3 media storage is not configured.');

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.s3.maxAttempts; attempt += 1) {
      try {
        const response = await this.s3RequestAttempt(method, key, body, contentType, range);
        if (allowNotFound && response.status === 404) return response;
        if (response.ok) return response;

        const error = new Error(`Private object storage request failed with HTTP ${response.status}.`);
        if (!this.isRetryableStatus(response.status) || attempt === this.s3.maxAttempts) throw error;
        lastError = error;
      } catch (error) {
        if (!this.isRetryableNetworkError(error) || attempt === this.s3.maxAttempts) throw error;
        lastError = error;
      }

      await this.retryDelay(attempt);
    }

    throw lastError instanceof Error ? lastError : new Error('Private object storage request failed.');
  }

  private async s3RequestAttempt(
    method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
    key: string,
    body?: Buffer,
    contentType?: string,
    range?: string
  ) {
    if (!this.s3) throw new Error('S3 media storage is not configured.');
    const url = this.objectUrl(this.s3, key);
    const now = new Date();
    const amzDate = this.amzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');
    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    };
    if (contentType) headers['content-type'] = contentType;
    if (range) headers.range = range;
    if (this.s3.sessionToken) headers['x-amz-security-token'] = this.s3.sessionToken;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaderNames.join(';'),
      payloadHash
    ].join('\n');
    const scope = `${dateStamp}/${this.s3.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    const signingKey = this.signingKey(this.s3.secretAccessKey, dateStamp, this.s3.region);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.s3.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames.join(';')}, Signature=${signature}`;

    return fetch(url, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(this.s3.timeoutMs)
    });
  }

  private isRetryableStatus(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  private isRetryableNetworkError(error: unknown) {
    if (!(error instanceof Error)) return false;
    return error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError;
  }

  private async retryDelay(attempt: number) {
    const delayMs = Math.min(100 * 2 ** (attempt - 1), 1_000);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  private objectUrl(config: S3Config, key: string) {
    const basePath = config.endpoint.pathname.replace(/\/$/, '');
    const encodedKey = key.split('/').map((part) => encodeURIComponent(part)).join('/');
    const url = new URL(config.endpoint.toString());
    url.pathname = `${basePath}/${encodeURIComponent(config.bucket)}/${encodedKey}`.replace(/\/+/g, '/');
    url.search = '';
    url.hash = '';
    return url;
  }

  private signingKey(secret: string, dateStamp: string, region: string) {
    const dateKey = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
    const regionKey = createHmac('sha256', dateKey).update(region).digest();
    const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
    return createHmac('sha256', serviceKey).update('aws4_request').digest();
  }

  private amzDate(value: Date) {
    return value.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private assertSafeKey(key: string) {
    if (!key || basename(key) !== key || key.includes('..') || !/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new Error('Invalid private media storage key.');
    }
  }

  private localPath(key: string) {
    return join(this.localRoot, key);
  }
}
