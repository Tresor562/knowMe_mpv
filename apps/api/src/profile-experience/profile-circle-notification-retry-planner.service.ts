import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationDeadLetterService } from './profile-circle-notification-dead-letter.service';
import {
  nextRetryAt,
  ProfileCircleNotificationPriority
} from './profile-circle-notification-resilience.domain';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';

@Injectable()
export class ProfileCircleNotificationRetryPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: ProfileCircleNotificationRuntimeConfigService,
    private readonly deadLetters: ProfileCircleNotificationDeadLetterService
  ) {}

  async planFailed(input: { limit?: number; now?: Date } = {}) {
    const now = input.now ?? new Date();
    const config = this.runtimeConfig.get();
    const failed =
      await this.prisma.profileCircleNotificationTransportAttempt.findMany({
        where: { status: 'FAILED', nextAttemptAt: { lte: now } },
        orderBy: [{ failedAt: 'asc' }, { id: 'asc' }],
        take: Math.min(1_000, Math.max(1, input.limit ?? 300))
      });

    let scheduled = 0;
    let deadLettered = 0;
    for (const attempt of failed) {
      if (attempt.attempts >= config.maxAttempts) {
        await this.deadLetters.capture({
          attemptId: attempt.id,
          userId: attempt.userId,
          channel: attempt.channel,
          provider: attempt.provider,
          idempotencyKey: `dead:${attempt.idempotencyKey}`,
          priority: this.priorityFromMetadata(attempt.metadata),
          reasonCode: attempt.errorCode ?? 'MAX_ATTEMPTS_REACHED',
          payload: {
            recipientId: attempt.recipientId,
            originalIdempotencyKey: attempt.idempotencyKey
          }
        });
        deadLettered += 1;
        continue;
      }

      const availableAt = nextRetryAt({
        now,
        attempt: Math.max(1, attempt.attempts),
        idempotencyKey: attempt.idempotencyKey,
        baseMs: config.retryBaseMs,
        maximumMs: config.retryMaximumMs
      });
      await this.prisma.profileCircleNotificationTransportAttempt.updateMany({
        where: { id: attempt.id, status: 'FAILED' },
        data: {
          status: 'PENDING',
          nextAttemptAt: availableAt,
          processingAt: null
        }
      });
      scheduled += 1;
    }

    return { scanned: failed.length, scheduled, deadLettered, serverTime: now };
  }

  async releaseDue(input: { limit?: number; now?: Date } = {}) {
    const now = input.now ?? new Date();
    return this.prisma.profileCircleNotificationTransportAttempt.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: Math.min(1_000, Math.max(1, input.limit ?? 300)),
      select: {
        id: true,
        userId: true,
        channel: true,
        provider: true,
        recipientId: true,
        idempotencyKey: true,
        attempts: true,
        metadata: true
      }
    });
  }

  private priorityFromMetadata(
    metadata: unknown
  ): ProfileCircleNotificationPriority {
    if (
      metadata &&
      typeof metadata === 'object' &&
      'priority' in metadata &&
      ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(
        String((metadata as { priority?: unknown }).priority)
      )
    ) {
      return String(
        (metadata as { priority?: unknown }).priority
      ) as ProfileCircleNotificationPriority;
    }
    return 'NORMAL';
  }
}
