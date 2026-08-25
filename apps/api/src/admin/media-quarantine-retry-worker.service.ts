import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { isMediaQuarantineRetryEligible } from './media-quarantine-retry-policy';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 10;

@Injectable()
export class MediaQuarantineRetryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaQuarantineRetryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly quarantine: MediaQuarantineOpsService
  ) {}

  onModuleInit() {
    if (!this.enabled()) return;
    this.timer = setInterval(() => {
      void this.runScheduledBatch();
    }, this.intervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
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
    try {
      await this.processEligibleBatch(new Date());
    } finally {
      this.running = false;
    }
  }

  private enabled() {
    return this.config.get<string>('MEDIA_QUARANTINE_RETRY_ENABLED')?.trim().toLowerCase() === 'true';
  }

  private intervalMs() {
    return this.boundedInteger(
      this.config.get<string>('MEDIA_QUARANTINE_RETRY_INTERVAL_MS'),
      DEFAULT_INTERVAL_MS,
      60_000,
      6 * 60 * 60 * 1000
    );
  }

  private batchSize() {
    return this.boundedInteger(
      this.config.get<string>('MEDIA_QUARANTINE_RETRY_BATCH_SIZE'),
      DEFAULT_BATCH_SIZE,
      1,
      100
    );
  }

  private boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    const normalized = raw.trim();
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
    if (String(parsed) !== normalized) return fallback;
    return parsed;
  }
}
