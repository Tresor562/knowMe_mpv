import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';
import { ProfileCircleNotificationLeaseService } from './profile-circle-notification-lease.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';
import { ProfileCircleNotificationTelemetryService } from './profile-circle-notification-telemetry.service';
import { ProfileCircleWeeklyDigestService } from './profile-circle-weekly-digest.service';

@Injectable()
export class ProfileCircleNotificationSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    ProfileCircleNotificationSchedulerService.name
  );
  private timer?: NodeJS.Timeout;
  private running = false;
  private ticks = 0;
  private lastRunAt?: Date;
  private lastResult?: Record<string, unknown>;
  private lastError?: string;

  constructor(
    private readonly delivery: ProfileCircleNotificationDeliveryService,
    private readonly leases: ProfileCircleNotificationLeaseService,
    private readonly weekly: ProfileCircleWeeklyDigestService,
    private readonly telemetry: ProfileCircleNotificationTelemetryService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  onApplicationBootstrap() {
    const config = this.runtimeConfig.get();
    if (!config.enabled) return;
    this.timer = setInterval(() => {
      void this.runScheduledTick();
    }, config.schedulerIntervalMs);
    this.timer.unref();
    void this.runScheduledTick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return { skipped: true, reason: 'LOCAL_RUN_ACTIVE' };
    this.running = true;
    const startedAt = Date.now();
    const config = this.runtimeConfig.get();
    const key = 'profile-circle-notification-delivery';
    let lease: Awaited<ReturnType<ProfileCircleNotificationLeaseService['acquire']>> | null = null;

    try {
      lease = await this.leases.acquire({
        key,
        ownerId: config.nodeId,
        ttlMs: config.leaseTtlMs
      });

      if (!lease) {
        return { skipped: true, reason: 'LEASE_HELD' };
      }

      this.ticks += 1;
      const retry =
        this.ticks % 10 === 0
          ? await this.delivery.retryFailed({ limit: config.schedulerBatchSize })
          : null;
      const flush = await this.delivery.flushDue({
        limit: config.schedulerBatchSize
      });
      const weekly =
        this.ticks % 20 === 0
          ? await this.weekly.flushDue({ limit: Math.min(100, config.schedulerBatchSize) })
          : null;
      this.lastRunAt = new Date();
      this.lastResult = { retry, flush, weekly };
      this.lastError = undefined;
      this.telemetry.schedulerSucceeded(flush);
      this.telemetry.observe('scheduler.tick', Date.now() - startedAt);
      return { skipped: false, retry, flush, weekly };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      this.telemetry.schedulerFailed(error);
      this.telemetry.observe('scheduler.tick.failed', Date.now() - startedAt);
      this.logger.error('Notification scheduler tick failed', error);
      throw error;
    } finally {
      try {
        if (lease) {
          await this.leases.release({
            key,
            ownerId: config.nodeId,
            leaseToken: lease.leaseToken
          });
        }
      } finally {
        this.running = false;
      }
    }
  }

  private async runScheduledTick() {
    try {
      await this.tick();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`Notification scheduler boundary contained ${errorName}; it will retry on the next interval.`);
    }
  }

  status() {
    const config = this.runtimeConfig.get();
    return {
      enabled: config.enabled,
      nodeId: config.nodeId,
      running: this.running,
      ticks: this.ticks,
      lastRunAt: this.lastRunAt ?? null,
      lastResult: this.lastResult ?? null,
      lastError: this.lastError ?? null,
      intervalMs: config.schedulerIntervalMs,
      batchSize: config.schedulerBatchSize
    };
  }
}
