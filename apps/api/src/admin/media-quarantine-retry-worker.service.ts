import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { isMediaQuarantineRetryEligible } from './media-quarantine-retry-policy';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 10;

type RetryBatchResult = { attempted: number; succeeded: number; failed: number };

@Injectable()
export class MediaQuarantineRetryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaQuarantineRetryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastAttemptAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastResult: RetryBatchResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly quarantine: MediaQuarantineOpsService
  ) {}

  onModuleInit() {
    const enabled = this.enabled();
    // Validate the complete production policy at startup even when retries are disabled.
    this.intervalMs();
    this.batchSize();
    if (!enabled) return;
    this.timer = setInterval(() => {
      void this.runScheduledBatch();
    }, this.intervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getSnapshot(now = new Date()) {
    const enabled = this.enabled();
    const intervalMs = this.intervalMs();
    const stale = enabled && this.lastAttemptAt !== null && now.getTime() - this.lastAttemptAt.getTime() > intervalMs * 2;
    const readiness = !enabled
      ? 'DISABLED'
      : this.lastAttemptAt === null
        ? 'AWAITING_FIRST_RUN'
        : stale
          ? 'STALE'
          : this.lastFailureAt && (!this.lastSuccessAt || this.lastFailureAt > this.lastSuccessAt)
            ? 'FAILING'
            : 'HEALTHY';

    return {
      enabled,
      running: this.running,
      readiness,
      intervalMs,
      batchSize: this.batchSize(),
      lastAttemptAt: this.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      lastResult: this.lastResult
    };
  }

  async processEligibleBatch(now = new Date()) {
    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        status: 'QUARANTINED',
        scannerVerdict: 'UNAVAILABLE',
        deletedAt: null,
        scannerAttemptCount: { lt: 5 },
        scannerLastAttemptAt: { not: null }
      },
      orderBy: [{ scannerLastAttemptAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        status: true,
        scannerVerdict: true,
        deletedAt: true,
        scannerAttemptCount: true,
        scannerLastAttemptAt: true
      },
      take: this.batchSize() * 4
    });

    const eligible = candidates
      .filter((candidate) => isMediaQuarantineRetryEligible(candidate, now))
      .slice(0, this.batchSize());

    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    for (const candidate of eligible) {
      attempted += 1;
      try {
        await this.quarantine.rescanUnavailable(null, candidate.id, 'AUTOMATIC');
        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown automatic media rescan failure';
        this.logger.warn(`Automatic media quarantine rescan failed for ${candidate.id}: ${message}`);
      }
    }

    return { attempted, succeeded, failed };
  }

  private async runScheduledBatch() {
    if (this.running) return;
    this.running = true;
    const attemptedAt = new Date();
    this.lastAttemptAt = attemptedAt;
    try {
      const result = await this.processEligibleBatch(attemptedAt);
      this.lastResult = result;
      if (result.failed > 0) {
        this.lastFailureAt = new Date();
      } else {
        this.lastSuccessAt = new Date();
      }
    } catch (error) {
      this.lastFailureAt = new Date();
      this.lastResult = null;
      const message = error instanceof Error ? error.message : 'Unknown automatic media quarantine retry batch failure';
      this.logger.error(`Automatic media quarantine retry batch failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  private enabled() {
    const raw = this.config.get<string>('MEDIA_QUARANTINE_RETRY_ENABLED');
    if (this.isProduction()) {
      if (raw !== 'true' && raw !== 'false') {
        throw new Error('MEDIA_QUARANTINE_RETRY_ENABLED must be explicitly set to canonical true or false in production.');
      }
      return raw === 'true';
    }
    return raw?.trim().toLowerCase() === 'true';
  }

  private intervalMs() {
    return this.boundedInteger(
      'MEDIA_QUARANTINE_RETRY_INTERVAL_MS',
      this.config.get<string>('MEDIA_QUARANTINE_RETRY_INTERVAL_MS'),
      DEFAULT_INTERVAL_MS,
      60_000,
      6 * 60 * 60 * 1000
    );
  }

  private batchSize() {
    return this.boundedInteger(
      'MEDIA_QUARANTINE_RETRY_BATCH_SIZE',
      this.config.get<string>('MEDIA_QUARANTINE_RETRY_BATCH_SIZE'),
      DEFAULT_BATCH_SIZE,
      1,
      100
    );
  }

  private boundedInteger(name: string, raw: string | undefined, fallback: number, min: number, max: number) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      if (this.isProduction()) throw new Error(`${name} is required in production.`);
      return fallback;
    }
    const normalized = raw.trim();
    const parsed = Number(normalized);
    const valid = Number.isSafeInteger(parsed) && parsed >= min && parsed <= max && String(parsed) === normalized;
    if (!valid) {
      if (this.isProduction()) {
        throw new Error(`${name} must be a canonical integer between ${min} and ${max} in production.`);
      }
      return fallback;
    }
    return parsed;
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
