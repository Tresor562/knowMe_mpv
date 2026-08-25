import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { classifyMediaQuarantineRetentionReadiness } from './media-quarantine-retention-readiness';
import { MediaPurgeAlertService } from './media-purge-alert.service';
import { MediaQuarantineRetentionWorkerService } from './media-quarantine-retention-worker.service';

const ALERT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const ALERT_REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const ALERTABLE = new Set(['BLOCKED_WORKER', 'BLOCKED_MAX_BACKOFF', 'ACTION_REQUIRED']);

@Injectable()
export class MediaPurgeAlertWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaPurgeAlertWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastReadiness: string | null = null;
  private lastDeliveredAt: Date | null = null;

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

  async runOnce(now = new Date()) {
    if (this.running) return 'SKIPPED_RUNNING' as const;
    this.running = true;
    try {
      const snapshot = await this.retention.getOperationalSnapshot(now);
      const readiness = classifyMediaQuarantineRetentionReadiness(snapshot.readiness, snapshot.backlog);
      if (!ALERTABLE.has(readiness)) {
        this.lastReadiness = readiness;
        this.lastDeliveredAt = null;
        return 'SKIPPED_NOT_ALERTABLE' as const;
      }

      const transitioned = readiness !== this.lastReadiness;
      const reminderDue = !this.lastDeliveredAt || now.getTime() - this.lastDeliveredAt.getTime() >= ALERT_REMINDER_INTERVAL_MS;
      this.lastReadiness = readiness;
      if (!transitioned && !reminderDue) return 'SKIPPED_DEDUPLICATED' as const;

      const delivery = await this.alerts.notify({
        event: 'MEDIA_QUARANTINE_PURGE_READINESS',
        readiness,
        observedAt: now.toISOString(),
        backlog: snapshot.backlog
      });
      if (delivery === 'DELIVERED') {
        this.lastDeliveredAt = now;
      } else if (delivery === 'FAILED') {
        this.logger.warn(`Media purge readiness alert delivery failed for state ${readiness}.`);
      }
      return delivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown media purge alert worker failure';
      this.logger.warn(`Media purge alert worker failed: ${message}`);
      return 'FAILED' as const;
    } finally {
      this.running = false;
    }
  }
}
