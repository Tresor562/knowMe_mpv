import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CallsService } from './calls.service';

@Injectable()
export class CallMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly calls: CallsService) {}

  onModuleInit() {
    if (process.env.CALL_MAINTENANCE_ENABLED === 'false') return;
    const interval = this.integerEnv('CALL_MAINTENANCE_INTERVAL_MS', 15_000, 5_000, 300_000);
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(limit?: number) {
    if (this.running) return { skipped: true, inspectedCalls: 0, missedCalls: 0 };
    this.running = true;
    try {
      const batchSize =
        limit ?? this.integerEnv('CALL_MAINTENANCE_BATCH_SIZE', 100, 1, 500);
      return { skipped: false, ...(await this.calls.expireDue(batchSize)) };
    } finally {
      this.running = false;
    }
  }

  private integerEnv(name: string, fallback: number, minimum: number, maximum: number) {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
  }
}
