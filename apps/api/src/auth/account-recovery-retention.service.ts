import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;

export type AccountRecoveryRetentionReadiness =
  | 'UNCONFIGURED'
  | 'DISABLED'
  | 'AWAITING_FIRST_RUN'
  | 'HEALTHY'
  | 'FAILING'
  | 'STALE';

@Injectable()
export class AccountRecoveryRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountRecoveryRetentionService.name);
  private timer?: NodeJS.Timeout;
  private lastAttemptAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastDeleted = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (!this.maintenanceEnabled()) return;
    if (this.retentionDays() === null) return;

    this.timer = setInterval(() => {
      void this.runScheduledPurge();
    }, this.intervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getMaintenanceSnapshot(now = new Date()) {
    const configured = this.retentionDays() !== null;
    const enabled = this.maintenanceEnabled();
    const intervalMs = this.intervalMs();
    const readiness = this.readiness(configured, enabled, intervalMs, now);
    const nextExpectedRunAt =
      configured && enabled && this.lastAttemptAt
        ? new Date(this.lastAttemptAt.getTime() + intervalMs)
        : null;

    return {
      configured,
      enabled,
      readiness,
      intervalMs,
      nextExpectedRunAt,
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastDeleted: this.lastDeleted
    };
  }

  async purgeExpiredBatch(now = new Date()) {
    this.lastAttemptAt = now;
    const retentionDays = this.retentionDays();
    if (retentionDays === null) {
      return { configured: false, deleted: 0, cutoff: null as Date | null };
    }

    const batchSize = this.boundedInteger(
      this.config.get<string>('ACCOUNT_RECOVERY_RETENTION_BATCH_SIZE'),
      DEFAULT_BATCH_SIZE,
      1,
      5_000
    );
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const candidates = await this.prisma.auditLog.findMany({
      where: {
        action: 'ACCOUNT_RECOVERY_ATTEMPT',
        entity: 'ACCOUNT_RECOVERY',
        createdAt: { lt: cutoff }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
      take: batchSize
    });

    if (candidates.length === 0) {
      this.lastSuccessAt = now;
      this.lastDeleted = 0;
      return { configured: true, deleted: 0, cutoff };
    }

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        id: { in: candidates.map((candidate) => candidate.id) },
        action: 'ACCOUNT_RECOVERY_ATTEMPT',
        entity: 'ACCOUNT_RECOVERY',
        createdAt: { lt: cutoff }
      }
    });

    this.lastSuccessAt = now;
    this.lastDeleted = result.count;
    return { configured: true, deleted: result.count, cutoff };
  }

  private async runScheduledPurge() {
    const now = new Date();
    try {
      const result = await this.purgeExpiredBatch(now);
      if (result.configured && result.deleted > 0) {
        this.logger.log(`Purged ${result.deleted} expired account-recovery audit record(s).`);
      }
    } catch (error) {
      this.lastFailureAt = now;
      const message = error instanceof Error ? error.message : 'Unknown retention maintenance failure';
      this.logger.error(`Account-recovery retention maintenance failed: ${message}`);
    }
  }

  private readiness(
    configured: boolean,
    enabled: boolean,
    intervalMs: number,
    now: Date
  ): AccountRecoveryRetentionReadiness {
    if (!configured) return 'UNCONFIGURED';
    if (!enabled) return 'DISABLED';
    if (this.lastFailureAt && (!this.lastSuccessAt || this.lastFailureAt > this.lastSuccessAt)) {
      return 'FAILING';
    }
    if (!this.lastAttemptAt) return 'AWAITING_FIRST_RUN';
    if (now.getTime() - this.lastAttemptAt.getTime() > intervalMs * 2) return 'STALE';
    return 'HEALTHY';
  }

  private intervalMs() {
    return this.boundedInteger(
      this.config.get<string>('ACCOUNT_RECOVERY_RETENTION_INTERVAL_MS'),
      DEFAULT_INTERVAL_MS,
      60_000,
      DAY_MS
    );
  }

  private maintenanceEnabled() {
    const raw = this.config.get<string>('ACCOUNT_RECOVERY_RETENTION_MAINTENANCE_ENABLED');
    if (typeof raw !== 'string' || raw.trim() === '') return true;
    return raw.trim().toLowerCase() === 'true';
  }

  private retentionDays() {
    const raw = this.config.get<string>('ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS');
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3_650 ? parsed : null;
  }

  private boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
    const parsed = Number(typeof raw === 'string' && raw.trim() !== '' ? raw : fallback);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
  }
}
