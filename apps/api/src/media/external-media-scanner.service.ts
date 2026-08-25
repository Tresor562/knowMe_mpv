import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export type ExternalMediaScannerVerdict = 'CLEAN' | 'INFECTED' | 'UNAVAILABLE';

export interface ExternalMediaScannerResult {
  verdict: ExternalMediaScannerVerdict;
  reference: string;
}

export interface ExternalMediaScanMetadata {
  mimeType: string;
}

interface ExternalScannerConfig {
  endpoint: string;
  token: string;
  timeoutMs: number;
}

const MIN_TOKEN_LENGTH = 32;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 4 * 1024;
const MAX_REFERENCE_LENGTH = 128;

@Injectable()
export class ExternalMediaScannerService {
  async scan(buffer: Buffer, metadata: ExternalMediaScanMetadata): Promise<ExternalMediaScannerResult> {
    const config = this.readConfig();
    if (!config) return this.unavailable('EXTERNAL_SCANNER_NOT_CONFIGURED');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          'content-type': 'application/octet-stream',
          'x-knowme-content-sha256': createHash('sha256').update(buffer).digest('hex'),
          'x-knowme-content-type': metadata.mimeType
        },
        body: buffer,
        signal: controller.signal
      });

      if (!response.ok) return this.unavailable('EXTERNAL_SCANNER_HTTP_ERROR');

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        return this.unavailable('EXTERNAL_SCANNER_RESPONSE_TOO_LARGE');
      }

      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
        return this.unavailable('EXTERNAL_SCANNER_RESPONSE_TOO_LARGE');
      }

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return this.unavailable('EXTERNAL_SCANNER_INVALID_RESPONSE');
      }

      if (!this.isValidPayload(payload)) {
        return this.unavailable('EXTERNAL_SCANNER_INVALID_RESPONSE');
      }

      return payload;
    } catch {
      return this.unavailable('EXTERNAL_SCANNER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  private readConfig(): ExternalScannerConfig | null {
    const endpoint = process.env.MEDIA_SCANNER_URL?.trim();
    const token = process.env.MEDIA_SCANNER_TOKEN?.trim();
    const timeoutRaw = process.env.MEDIA_SCANNER_TIMEOUT_MS?.trim();
    if (!endpoint || !token || !timeoutRaw) return null;

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return null;
    }

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      token.length < MIN_TOKEN_LENGTH ||
      !/^\d+$/.test(timeoutRaw)
    ) {
      return null;
    }

    const timeoutMs = Number(timeoutRaw);
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS ||
      String(timeoutMs) !== timeoutRaw
    ) {
      return null;
    }

    return { endpoint: url.toString(), token, timeoutMs };
  }

  private isValidPayload(value: unknown): value is ExternalMediaScannerResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if (keys.length !== 2 || !keys.includes('verdict') || !keys.includes('reference')) return false;

    const payload = value as Record<string, unknown>;
    if (payload.verdict !== 'CLEAN' && payload.verdict !== 'INFECTED') return false;
    return (
      typeof payload.reference === 'string' &&
      payload.reference.length > 0 &&
      payload.reference.length <= MAX_REFERENCE_LENGTH &&
      !/[\r\n]/.test(payload.reference)
    );
  }

  private unavailable(reference: string): ExternalMediaScannerResult {
    return { verdict: 'UNAVAILABLE', reference };
  }
}
