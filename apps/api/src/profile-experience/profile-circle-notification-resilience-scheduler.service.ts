import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { ProfileCircleNotificationLeaseService } from './profile-circle-notification-lease.service';
import { ProfileCircleNotificationRateLimitService } from './profile-circle-notification-rate-limit.service';
import { ProfileCircleNotificationRetryPlannerService } from './profile-circle-notification-retry-planner.service';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';
import { ProfileCircleNotificationSuppressionService } from './profile-circle-notification-suppression.service';

@Injectable()
export class ProfileCircleNotificationResilienceSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    ProfileCircleNotificationResilienceSchedulerService.name
  );
  private timer?: NodeJS.Timeout;
  private running = false;
  private runs = 0;
  private lastRunAt?: Date;
  private lastResult?: Record<string, unknown>;
  private lastError?: string;

  constructor(
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService,
    private readonly leases: ProfileCircleNotificationLeaseService,
    private readonly retries: ProfileCircleNotificationRetryPlannerService,
    private readonly rateLimits: ProfileCircleNotificationRateLimitService,
    private readonly suppressions: ProfileCircleNotificationSuppressionService
  ) {}

  onApplicationBootstrap() {
    const config = this.runtimeConfig.get();
    if (!config.enabled || !config.resilienceEnabled) return;
    const interval = Math.max(30_000, config.schedulerIntervalMs * 2);
    this.timer = setInterval(() => {
      void this.runScheduledTick();
    }, interval);
    this.timer.unref();
    void this.runScheduledTick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return { skipped: true, reason: 'LOCAL_RUN_ACTIVE' };
    this.running = true;
    const config = this.runtimeConfig.get();
    const key = 'profile-circle-notification-resilience';
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

      this.runs += 1;
      const retry = await this.retries.planFailed({
        limit: config.schedulerBatchSize
      });
      const expiredSuppressions = await this.suppressions.expire();
      const cleanedBuckets =
        this.runs % 10 === 0 ? await this.rateLimits.cleanup() : 0;
      this.lastRunAt = new Date();
      this.lastResult = { retry, expiredSuppressions, cleanedBuckets };
      this.lastError = undefined;
      return { skipped: false, ...this.lastResult };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      this.logger.error('Notification resilience maintenance failed', error);
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
      this.logger.error(`Notification resilience boundary contained ${errorName}; it will retry on the next interval.`);
    }
  }

  status() {
    return {
      enabled: this.runtimeConfig.get().resilienceEnabled,
      running: this.running,
      runs: this.runs,
      lastRunAt: this.lastRunAt ?? null,
      lastResult: this.lastResult ?? null,
      lastError: this.lastError ?? null
    };
  }
}
