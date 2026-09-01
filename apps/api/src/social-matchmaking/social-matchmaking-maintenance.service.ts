import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SocialConnectionService } from './social-connection.service';
import { SocialMatchmakingService } from './social-matchmaking.service';

@Injectable()
export class SocialMatchmakingMaintenanceService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SocialMatchmakingMaintenanceService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly matchmaking: SocialMatchmakingService,
    private readonly connections: SocialConnectionService
  ) {}

  onModuleInit() {
    if (process.env.SOCIAL_MATCHMAKING_MAINTENANCE_ENABLED === 'false') return;
    const intervalMs = this.integerEnv(
      'SOCIAL_MATCHMAKING_MAINTENANCE_INTERVAL_MS',
      60_000,
      10_000,
      3_600_000
    );
    this.timer = setInterval(() => {
      void this.runScheduledTick();
    }, intervalMs);
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
        expiredConnectionIntents: 0,
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
      const [expired, expiredConnections] = await Promise.all([
        this.matchmaking.expireDue(batchSize),
        this.connections.expireDue(batchSize)
      ]);
      const matched = await this.matchmaking.matchQueued(batchSize);
      return {
        skipped: false,
        ...expired,
        ...expiredConnections,
        ...matched
      };
    } finally {
      this.running = false;
    }
  }

  private async runScheduledTick() {
    try {
      await this.tick();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`Social matchmaking maintenance failed (${errorName}); it will retry on the next interval.`);
    }
  }

  private integerEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name]);
    return Number.isInteger(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : fallback;
  }
}
