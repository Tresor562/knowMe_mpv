import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CreatorMetricsRetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.CREATOR_METRICS_RETENTION_ENABLED === 'false') return;
    const intervalMs = this.integerEnv(
      'CREATOR_METRICS_RETENTION_INTERVAL_MS',
      21_600_000,
      60_000,
      86_400_000
    );
    this.timer = setInterval(() => void this.cleanup(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanup(limit = 1_000) {
    if (this.running) return { skipped: true, deleted: 0 };
    this.running = true;
    try {
      const expired = await this.prisma.creatorAudienceReceipt.findMany({
        where: { expiresAt: { lt: new Date() } },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: Math.min(5_000, Math.max(1, limit)),
        select: { id: true }
      });
      if (!expired.length) return { skipped: false, deleted: 0 };
      const result = await this.prisma.creatorAudienceReceipt.deleteMany({
        where: { id: { in: expired.map((item) => item.id) } }
      });
      return { skipped: false, deleted: result.count };
    } finally {
      this.running = false;
    }
  }

  private integerEnv(name: string, fallback: number, min: number, max: number) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }
}
