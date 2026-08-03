import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';
import { ProfileCircleNotificationLeaseService } from './profile-circle-notification-lease.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

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
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService
  ) {}

  onApplicationBootstrap() {
    const config = this.runtimeConfig.get();
    if (!config.enabled) return;
    this.timer = setInterval(() => void this.tick(), config.schedulerIntervalMs);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return { skipped: true, reason: 'LOCAL_RUN_ACTIVE' };
    this.running = true;
    const config = this.runtimeConfig.get();
    const key = 'profile-circle-notification-delivery';
    const lease = await this.leases.acquire({
      key,
      ownerId: config.nodeId,
      ttlMs: config.leaseTtlMs
    });

    if (!lease) {
      this.running = false;
      return { skipped: true, reason: 'LEASE_HELD' };
    }

    try {
      this.ticks += 1;
      const retry =
        this.ticks % 10 === 0
          ? await this.delivery.retryFailed({ limit: config.schedulerBatchSize })
          : null;
      const flush = await this.delivery.flushDue({
        limit: config.schedulerBatchSize
      });
      this.lastRunAt = new Date();
      this.lastResult = { retry, flush };
      this.lastError = undefined;
      return { skipped: false, retry, flush };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      this.logger.error('Notification scheduler tick failed', error);
      throw error;
    } finally {
      await this.leases.release({
        key,
        ownerId: config.nodeId,
        leaseToken: lease.leaseToken
      });
      this.running = false;
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
