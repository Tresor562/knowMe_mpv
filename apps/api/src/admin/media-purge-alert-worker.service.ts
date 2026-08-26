import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { classifyMediaQuarantineRetentionReadiness } from './media-quarantine-retention-readiness';
import { MediaPurgeAlertService } from './media-purge-alert.service';
import { MediaQuarantineRetentionWorkerService } from './media-quarantine-retention-worker.service';

const ALERT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const ALERT_REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const ALERTABLE = new Set(['BLOCKED_WORKER', 'BLOCKED_MAX_BACKOFF', 'ACTION_REQUIRED']);

export type MediaPurgeAlertWorkerResult =
  | 'DELIVERED'
  | 'SKIPPED_NOT_CONFIGURED'
  | 'SKIPPED_RUNNING'
  | 'SKIPPED_NOT_ALERTABLE'
  | 'SKIPPED_DEDUPLICATED'
  | 'FAILED';

export type MediaPurgeAlertWorkerSnapshot = {
  running: boolean;
  pollIntervalMs: number;
  reminderIntervalMs: number;
  lastObservedReadiness: string | null;
  lastPollAt: string | null;
  lastAlertAttemptAt: string | null;
  lastDeliveredAt: string | null;
  lastFailureAt: string | null;
  lastResult: MediaPurgeAlertWorkerResult | null;
};

@Injectable()
export class MediaPurgeAlertWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaPurgeAlertWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastReadiness: string | null = null;
  private lastPollAt: Date | null = null;
  private lastAlertAttemptAt: Date | null = null;
  private lastDeliveredAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastResult: MediaPurgeAlertWorkerResult | null = null;

  constructor(
    private readonly retention: MediaQuarantineRetentionWorkerService,
    private readonly alerts: MediaPurgeAlertService
  ) {}

  onModuleInit() {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), ALERT_POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getSnapshot(): MediaPurgeAlertWorkerSnapshot {
    return {
      running: this.running,
      pollIntervalMs: ALERT_POLL_INTERVAL_MS,
      reminderIntervalMs: ALERT_REMINDER_INTERVAL_MS,
      lastObservedReadiness: this.lastReadiness,
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
      lastAlertAttemptAt: this.lastAlertAttemptAt?.toISOString() ?? null,
      lastDeliveredAt: this.lastDeliveredAt?.toISOString() ?? null,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      lastResult: this.lastResult
    };
  }

  async runOnce(now = new Date()): Promise<MediaPurgeAlertWorkerResult> {
    if (this.running) return 'SKIPPED_RUNNING';
    this.running = true;
    this.lastPollAt = now;
    try {
      const snapshot = await this.retention.getOperationalSnapshot(now);
      const readiness = classifyMediaQuarantineRetentionReadiness(snapshot.readiness, snapshot.backlog);
      const previousReadiness = this.lastReadiness;
      this.lastReadiness = readiness;
      if (!ALERTABLE.has(readiness)) {
        this.lastDeliveredAt = null;
        this.lastResult = 'SKIPPED_NOT_ALERTABLE';
        return this.lastResult;
      }

      const transitioned = readiness !== previousReadiness;
      const reminderDue = !this.lastDeliveredAt || now.getTime() - this.lastDeliveredAt.getTime() >= ALERT_REMINDER_INTERVAL_MS;
      if (!transitioned && !reminderDue) {
        this.lastResult = 'SKIPPED_DEDUPLICATED';
        return this.lastResult;
      }

      this.lastAlertAttemptAt = now;
      const delivery = await this.alerts.notify({
        event: 'MEDIA_QUARANTINE_PURGE_READINESS',
        readiness,
        observedAt: now.toISOString(),
        backlog: snapshot.backlog
      });
      this.lastResult = delivery;
      if (delivery === 'DELIVERED') {
        this.lastDeliveredAt = now;
      } else if (delivery === 'FAILED') {
        this.lastFailureAt = now;
        this.logger.warn(`Media purge readiness alert delivery failed for state ${readiness}.`);
      }
      return delivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown media purge alert worker failure';
      this.lastFailureAt = now;
      this.lastResult = 'FAILED';
      this.logger.warn(`Media purge alert worker failed: ${message}`);
      return 'FAILED';
    } finally {
      this.running = false;
    }
  }
}
