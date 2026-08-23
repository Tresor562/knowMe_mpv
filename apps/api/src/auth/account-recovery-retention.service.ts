import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;

@Injectable()
export class AccountRecoveryRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (!this.maintenanceEnabled()) return;
    if (this.retentionDays() === null) return;

    const intervalMs = this.boundedInteger(
      this.config.get<string>('ACCOUNT_RECOVERY_RETENTION_INTERVAL_MS'),
      DEFAULT_INTERVAL_MS,
      60_000,
      DAY_MS
    );

    this.timer = setInterval(() => {
      void this.purgeExpiredBatch().catch(() => undefined);
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async purgeExpiredBatch(now = new Date()) {
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

    return { configured: true, deleted: result.count, cutoff };
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
