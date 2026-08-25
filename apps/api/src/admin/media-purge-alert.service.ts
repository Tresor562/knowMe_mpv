import { Injectable } from '@nestjs/common';
import { MediaQuarantineRetentionReadiness } from './media-quarantine-retention-readiness';

export type MediaPurgeAlertBacklog = {
  expiredQuarantined: number;
  retryDue: number;
  retryScheduled: number;
  maxBackoffRetries: number;
  nextScheduledRetryAt: string | null;
};

export type MediaPurgeAlertPayload = {
  event: 'MEDIA_QUARANTINE_PURGE_READINESS';
  readiness: MediaQuarantineRetentionReadiness;
  observedAt: string;
  backlog: MediaPurgeAlertBacklog;
};

export type MediaPurgeAlertDelivery = 'DELIVERED' | 'SKIPPED_NOT_CONFIGURED' | 'FAILED';

interface MediaPurgeAlertConfig {
  endpoint: string;
  token: string;
  timeoutMs: number;
}

const MIN_TOKEN_LENGTH = 32;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024;
const ALERTABLE_READINESS = new Set<MediaQuarantineRetentionReadiness>([
  'BLOCKED_WORKER',
  'BLOCKED_MAX_BACKOFF',
  'ACTION_REQUIRED'
]);

@Injectable()
export class MediaPurgeAlertService {
  async notify(payload: MediaPurgeAlertPayload): Promise<MediaPurgeAlertDelivery> {
    if (!ALERTABLE_READINESS.has(payload.readiness)) return 'SKIPPED_NOT_CONFIGURED';

    const config = this.readConfig();
    if (!config) return 'SKIPPED_NOT_CONFIGURED';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) return 'FAILED';

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) return 'FAILED';
      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) return 'FAILED';
      return 'DELIVERED';
    } catch {
      return 'FAILED';
    } finally {
      clearTimeout(timeout);
    }
  }

  private readConfig(): MediaPurgeAlertConfig | null {
    const endpoint = process.env.MEDIA_PURGE_ALERT_WEBHOOK_URL?.trim();
    const token = process.env.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN?.trim();
    const timeoutRaw = process.env.MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS?.trim();
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
}
