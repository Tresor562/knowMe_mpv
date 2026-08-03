import { Injectable } from '@nestjs/common';

type DeliveryChannel = 'IN_APP' | 'PUSH' | 'EMAIL';
type DeliveryOutcome = 'DELIVERED' | 'FAILED' | 'SUPPRESSED' | 'RESCHEDULED';

@Injectable()
export class ProfileCircleNotificationTelemetryService {
  private readonly counters = new Map<string, number>();
  private readonly durations = new Map<
    string,
    { count: number; totalMs: number; maxMs: number }
  >();
  private lastSchedulerAt?: Date;
  private lastSchedulerError?: string;

  increment(
    channel: DeliveryChannel,
    outcome: DeliveryOutcome,
    value = 1
  ) {
    const key = `delivery.${channel.toLowerCase()}.${outcome.toLowerCase()}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + Math.max(0, value));
  }

  observe(operation: string, durationMs: number) {
    const key = this.safeOperation(operation);
    const current = this.durations.get(key) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0
    };
    current.count += 1;
    current.totalMs += Math.max(0, durationMs);
    current.maxMs = Math.max(current.maxMs, durationMs);
    this.durations.set(key, current);
  }

  schedulerSucceeded(result: {
    delivered?: number;
    failed?: number;
    suppressed?: number;
    rescheduled?: number;
  }) {
    this.lastSchedulerAt = new Date();
    this.lastSchedulerError = undefined;
    this.increment('IN_APP', 'DELIVERED', result.delivered ?? 0);
    this.increment('IN_APP', 'FAILED', result.failed ?? 0);
    this.increment('IN_APP', 'SUPPRESSED', result.suppressed ?? 0);
    this.increment('IN_APP', 'RESCHEDULED', result.rescheduled ?? 0);
  }

  schedulerFailed(error: unknown) {
    this.lastSchedulerAt = new Date();
    this.lastSchedulerError =
      error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN_ERROR';
    this.increment('IN_APP', 'FAILED');
  }

  snapshot() {
    return {
      counters: Object.fromEntries(this.counters.entries()),
      durations: Object.fromEntries(
        [...this.durations.entries()].map(([key, value]) => [
          key,
          {
            count: value.count,
            averageMs:
              value.count === 0 ? 0 : Math.round(value.totalMs / value.count),
            maxMs: Math.round(value.maxMs)
          }
        ])
      ),
      scheduler: {
        lastRunAt: this.lastSchedulerAt ?? null,
        lastError: this.lastSchedulerError ?? null
      }
    };
  }

  private safeOperation(value: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    return normalized.slice(0, 80) || 'unknown';
  }
}
