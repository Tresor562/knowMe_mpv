import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { createConnection } from 'node:net';

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
    if (!config) {
      if (process.env.MEDIA_CLAMD_HOST?.trim()) return this.scanWithClamd(buffer);
      return this.unavailable('EXTERNAL_SCANNER_NOT_CONFIGURED');
    }

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

  /**
   * CLAMD INSTREAM protocol via the private Docker network.
   * Strictly fail closed: a timeout, malformed response or unknown verdict is
   * UNAVAILABLE and keeps the asset quarantined. No shell invocation or
   * untrusted filenames enter the scanner.
   */
  private async scanWithClamd(buffer: Buffer): Promise<ExternalMediaScannerResult> {
    const hostname = String(process.env.MEDIA_CLAMD_HOST || '').trim();
    const portRaw = String(process.env.MEDIA_CLAMD_PORT || '3310');
    const port = Number(portRaw);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,79}$/.test(hostname) ||
        !Number.isInteger(port) || port < 1 || port > 65535) {
      return this.unavailable('CLAMD_INVALID_CONFIG');
    }
    return new Promise<ExternalMediaScannerResult>((resolve) => {
      const socket = createConnection({ host: hostname, port });
      let finished = false;
      let reply = '';
      const finish = (result: ExternalMediaScannerResult) => {
        if (finished) return;
        finished = true;
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(20_000);
      socket.on('timeout', () => finish(this.unavailable('CLAMD_TIMEOUT')));
      socket.on('error', () => finish(this.unavailable('CLAMD_CONNECTION_ERROR')));
      socket.on('data', (chunk: Buffer) => {
        if (finished) return;
        reply += chunk.toString('utf8');
        if (reply.length > 1024) { finish(this.unavailable('CLAMD_INVALID_RESPONSE')); return; }
        const response = reply.replace(/\0/g, '').trim();
        if (/^stream: OK$/i.test(response)) {
          finish({ verdict: 'CLEAN', reference: 'CLAMD:INSTREAM:OK' });
        } else if (/^stream: .{1,90} FOUND$/i.test(response)) {
          finish({ verdict: 'INFECTED', reference: 'CLAMD:INSTREAM:FOUND' });
        } else if (/^stream: .{1,100} ERROR$/i.test(response)) {
          finish(this.unavailable('CLAMD_SCAN_ERROR'));
        }
      });
      socket.on('end', () => {
        if (!finished) finish(this.unavailable('CLAMD_INCOMPLETE_RESPONSE'));
      });
      socket.on('connect', () => {
        if (finished) return;
        socket.write(Buffer.from('zINSTREAM\0', 'utf8'));
        // Send framed fixed-size chunks, bounded by the API upload size limit.
        for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
          const slice = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
          const size = Buffer.allocUnsafe(4);
          size.writeUInt32BE(slice.length, 0);
          socket.write(size);
          socket.write(slice);
        }
        socket.end(Buffer.alloc(4));
      });
    });
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
