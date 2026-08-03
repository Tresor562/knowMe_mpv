import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationCenterDigestService } from './notification-center-digest.service';

@Injectable()
export class NotificationCenterDigestSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    NotificationCenterDigestSchedulerService.name
  );
  private timer?: NodeJS.Timeout;
  private running = false;
  private ticks = 0;
  private lastRunAt?: Date;
  private lastResult?: Record<string, unknown>;
  private lastError?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly digests: NotificationCenterDigestService
  ) {}

  onApplicationBootstrap() {
    if (!this.enabled()) return;
    const interval = this.intervalMs();
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return { skipped: true, reason: 'LOCAL_RUN_ACTIVE' };
    this.running = true;
    try {
      this.ticks += 1;
      const result = await this.digests.flushDue({ limit: this.batchSize() });
      this.lastRunAt = new Date();
      this.lastResult = result;
      this.lastError = undefined;
      return { skipped: false, ...result };
    } catch (error) {
      const code =
        error instanceof Error ? error.message.slice(0, 180) : 'UNKNOWN_ERROR';
      this.lastError = code;
      this.logger.error(`Notification digest tick failed: ${code}`);
      return { skipped: false, failed: true, errorCode: code };
    } finally {
      this.running = false;
    }
  }

  status() {
    return {
      enabled: this.enabled(),
      running: this.running,
      ticks: this.ticks,
      intervalMs: this.intervalMs(),
      batchSize: this.batchSize(),
      lastRunAt: this.lastRunAt ?? null,
      lastResult: this.lastResult ?? null,
      lastError: this.lastError ?? null
    };
  }

  private enabled() {
    const value = this.config.get<string | boolean>(
      'NOTIFICATION_CENTER_DIGEST_ENABLED'
    );
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return true;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private intervalMs() {
    return this.integer(
      'NOTIFICATION_CENTER_DIGEST_INTERVAL_MS',
      60_000,
      10_000,
      15 * 60_000
    );
  }

  private batchSize() {
    return this.integer(
      'NOTIFICATION_CENTER_DIGEST_BATCH_SIZE',
      500,
      1,
      2_000
    );
  }

  private integer(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number
  ) {
    const raw = this.config.get<string | number>(key);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
  }
}
