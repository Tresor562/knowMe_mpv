import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ProfileCircleNotificationRuntimeConfig = {
  enabled: boolean;
  schedulerIntervalMs: number;
  schedulerBatchSize: number;
  leaseTtlMs: number;
  nodeId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  weeklyDigestEnabled: boolean;
  maxAttempts: number;
};

@Injectable()
export class ProfileCircleNotificationRuntimeConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): ProfileCircleNotificationRuntimeConfig {
    return {
      enabled: this.boolean('PROFILE_NOTIFICATION_RUNTIME_ENABLED', true),
      schedulerIntervalMs: this.integer(
        'PROFILE_NOTIFICATION_SCHEDULER_INTERVAL_MS',
        30_000,
        5_000,
        15 * 60_000
      ),
      schedulerBatchSize: this.integer(
        'PROFILE_NOTIFICATION_SCHEDULER_BATCH_SIZE',
        500,
        1,
        1_000
      ),
      leaseTtlMs: this.integer(
        'PROFILE_NOTIFICATION_SCHEDULER_LEASE_TTL_MS',
        90_000,
        15_000,
        30 * 60_000
      ),
      nodeId:
        this.config.get<string>('PROFILE_NOTIFICATION_NODE_ID')?.trim() ||
        `${process.env.HOSTNAME || 'local'}:${process.pid}`,
      pushEnabled: this.boolean('PROFILE_NOTIFICATION_PUSH_ENABLED', false),
      emailEnabled: this.boolean('PROFILE_NOTIFICATION_EMAIL_ENABLED', false),
      weeklyDigestEnabled: this.boolean(
        'PROFILE_NOTIFICATION_WEEKLY_DIGEST_ENABLED',
        false
      ),
      maxAttempts: this.integer(
        'PROFILE_NOTIFICATION_MAX_ATTEMPTS',
        8,
        1,
        100
      )
    };
  }

  private boolean(key: string, fallback: boolean) {
    const value = this.config.get<string | boolean>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private integer(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number
  ) {
    const raw = this.config.get<string | number>(key);
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
  }
}
