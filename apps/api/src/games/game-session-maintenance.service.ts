import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GamePlatformService } from './game-platform.service';

@Injectable()
export class GameSessionMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly games: GamePlatformService) {}

  onModuleInit() {
    if (process.env.GAME_PLATFORM_MAINTENANCE_ENABLED === 'false') return;
    const intervalMs = this.integerEnv(
      'GAME_PLATFORM_MAINTENANCE_INTERVAL_MS',
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
    if (this.running) return { skipped: true, inspected: 0, expired: 0 };
    this.running = true;
    try {
      const batchSize =
        limit ??
        this.integerEnv('GAME_PLATFORM_MAINTENANCE_BATCH_SIZE', 100, 1, 500);
      return { skipped: false, ...(await this.games.expireDue(batchSize)) };
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
