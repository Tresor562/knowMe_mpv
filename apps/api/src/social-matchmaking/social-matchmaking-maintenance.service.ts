import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SocialMatchmakingService } from './social-matchmaking.service';

@Injectable()
export class SocialMatchmakingMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly matchmaking: SocialMatchmakingService) {}

  onModuleInit() {
    if (process.env.SOCIAL_MATCHMAKING_MAINTENANCE_ENABLED === 'false') return;
    const intervalMs = this.integerEnv(
      'SOCIAL_MATCHMAKING_MAINTENANCE_INTERVAL_MS',
      60_000,
      10_000,
      3_600_000
    );
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(limit?: number) {
    if (this.running) {
      return {
        skipped: true,
        expiredEntries: 0,
        expiredProposals: 0,
        inspected: 0,
        matched: 0
      };
    }
    this.running = true;
    try {
      const batchSize =
        limit ??
        this.integerEnv(
          'SOCIAL_MATCHMAKING_MAINTENANCE_BATCH_SIZE',
          100,
          1,
          500
        );
      const expired = await this.matchmaking.expireDue(batchSize);
      const matched = await this.matchmaking.matchQueued(batchSize);
      return { skipped: false, ...expired, ...matched };
    } finally {
      this.running = false;
    }
  }

  private integerEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name]);
    return Number.isInteger(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : fallback;
  }
}
