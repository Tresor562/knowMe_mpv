import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from '../media/media-storage.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const BATCH_SIZE = 25;

type PurgeCandidate = {
  id: string;
  ownerId: string;
  storageKey: string;
  scannerVerdict: string;
  status: string;
  createdAt: Date;
};

type RetentionBatchResult = { considered: number; purged: number; failed: number };

@Injectable()
export class MediaQuarantineRetentionWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaQuarantineRetentionWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastAttemptAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastResult: RetentionBatchResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: MediaStorageService,
    private readonly audit: AuditService
  ) {}

  onModuleInit() {
    const policy = this.retentionPolicy();
    if (!policy) return;

    void this.runScheduledBatch();
    this.timer = setInterval(() => {
      void this.runScheduledBatch();
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getSnapshot(now = new Date()) {
    const policy = this.retentionPolicy();
    const enabled = policy !== null;
    const stale = enabled && this.lastAttemptAt !== null && now.getTime() - this.lastAttemptAt.getTime() > SWEEP_INTERVAL_MS * 2;
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
      intervalMs: SWEEP_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      infectedRetentionDays: policy?.infectedDays ?? null,
      unavailableRetentionDays: policy?.unavailableDays ?? null,
      lastAttemptAt: this.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      lastResult: this.lastResult
    };
  }

  async processExpiredBatch(now = new Date()) {
    const policy = this.retentionPolicy();
    if (!policy) return { considered: 0, purged: 0, failed: 0 };

    const infectedCutoff = this.cutoff(now, policy.infectedDays);
    const unavailableCutoff = this.cutoff(now, policy.unavailableDays);
    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        deletedAt: null,
        scannerVerdict: { in: ['INFECTED', 'UNAVAILABLE'] },
        status: { in: ['QUARANTINED', 'PURGING'] },
        OR: [
          { scannerVerdict: 'INFECTED', createdAt: { lte: infectedCutoff } },
          { scannerVerdict: 'UNAVAILABLE', createdAt: { lte: unavailableCutoff } }
        ]
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: {
        id: true,
        ownerId: true,
        storageKey: true,
        scannerVerdict: true,
        status: true,
        createdAt: true
      }
    });

    let purged = 0;
    let failed = 0;
    for (const candidate of candidates) {
      try {
        const claimed = await this.claim(candidate, infectedCutoff, unavailableCutoff);
        if (!claimed) continue;

        await this.storage.delete(candidate.storageKey);
        await this.audit.record({
          actorId: null,
          action: 'MEDIA_QUARANTINE_RETENTION_OBJECT_DELETED',
          entity: 'MediaAsset',
          entityId: candidate.id,
          targetAccountId: candidate.ownerId,
          metadata: {
            scannerVerdict: candidate.scannerVerdict,
            retentionSource: 'AUTOMATIC'
          }
        });

        const removed = await this.prisma.mediaAsset.deleteMany({
          where: {
            id: candidate.id,
            status: 'PURGING',
            scannerVerdict: candidate.scannerVerdict,
            deletedAt: null
          }
        });
        if (removed.count !== 1) {
          throw new Error('Quarantined media metadata changed during retention purge.');
        }
        purged += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown quarantine retention purge failure';
        this.logger.error(`Media quarantine retention purge failed: ${message}`);
      }
    }

    return { considered: candidates.length, purged, failed };
  }

  private async claim(candidate: PurgeCandidate, infectedCutoff: Date, unavailableCutoff: Date) {
    if (candidate.status === 'PURGING') return true;
    const cutoff = candidate.scannerVerdict === 'INFECTED' ? infectedCutoff : unavailableCutoff;
    const claimed = await this.prisma.mediaAsset.updateMany({
      where: {
        id: candidate.id,
        status: 'QUARANTINED',
        scannerVerdict: candidate.scannerVerdict,
        deletedAt: null,
        createdAt: { lte: cutoff }
      },
      data: { status: 'PURGING' }
    });
    return claimed.count === 1;
  }

  private async runScheduledBatch() {
    if (this.running) return;
    this.running = true;
    const attemptedAt = new Date();
    this.lastAttemptAt = attemptedAt;
    try {
      const result = await this.processExpiredBatch(attemptedAt);
      this.lastResult = result;
      if (result.failed > 0) {
        this.lastFailureAt = new Date();
      } else {
        this.lastSuccessAt = new Date();
      }
    } catch (error) {
      this.lastFailureAt = new Date();
      this.lastResult = null;
      const message = error instanceof Error ? error.message : 'Unknown quarantine retention sweep failure';
      this.logger.error(`Media quarantine retention sweep failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  private retentionPolicy() {
    const infectedDays = this.retentionDays('MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS');
    const unavailableDays = this.retentionDays('MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS');
    if (infectedDays === null || unavailableDays === null) {
      if (this.isProduction()) {
        throw new Error('Media quarantine retention policy must be fully configured in production.');
      }
      return null;
    }
    return { infectedDays, unavailableDays };
  }

  private retentionDays(name: string) {
    const raw = this.config.get<string>(name);
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    const normalized = raw.trim();
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3650 || String(parsed) !== normalized) {
      throw new Error(`${name} must be a canonical integer between 1 and 3650.`);
    }
    return parsed;
  }

  private cutoff(now: Date, days: number) {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
