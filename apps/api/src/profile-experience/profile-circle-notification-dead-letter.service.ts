import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationPriority } from './profile-circle-notification-resilience.domain';

class DiscardProfileCircleNotificationDeadLetterDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

@Injectable()
export class ProfileCircleNotificationDeadLetterService {
  constructor(private readonly prisma: PrismaService) {}

  capture(input: {
    attemptId?: string;
    userId: string;
    channel: ProfileCircleTransportChannel;
    provider: string;
    idempotencyKey: string;
    priority: ProfileCircleNotificationPriority;
    reasonCode: string;
    payload?: Record<string, unknown>;
  }) {
    return this.prisma.profileCircleNotificationDeadLetter.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        attemptId: input.attemptId ?? null,
        userId: input.userId,
        channel: input.channel,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        priority: input.priority,
        reasonCode: input.reasonCode,
        payload: input.payload ?? undefined
      },
      update: {
        reasonCode: input.reasonCode,
        lastErrorCode: input.reasonCode,
        payload: input.payload ?? undefined,
        availableAt: new Date()
      }
    });
  }

  list(input: { status?: string; limit?: number } = {}) {
    const limit = Math.min(500, Math.max(1, input.limit ?? 100));
    return this.prisma.profileCircleNotificationDeadLetter.findMany({
      where: input.status
        ? {
            status: input.status as
              | 'OPEN'
              | 'REPLAYING'
              | 'RESOLVED'
              | 'DISCARDED'
          }
        : undefined,
      orderBy: [{ priority: 'desc' }, { availableAt: 'asc' }],
      take: limit
    });
  }

  async replay(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.profileCircleNotificationDeadLetter.findUnique({
        where: { id }
      });
      if (!item || !['OPEN', 'REPLAYING'].includes(item.status)) {
        throw new Error('NOTIFICATION_DEAD_LETTER_NOT_REPLAYABLE');
      }
      if (item.attemptId) {
        await tx.profileCircleNotificationTransportAttempt.updateMany({
          where: { id: item.attemptId },
          data: {
            status: 'PENDING',
            nextAttemptAt: new Date(),
            processingAt: null,
            failedAt: null,
            errorCode: null
          }
        });
      }
      return tx.profileCircleNotificationDeadLetter.update({
        where: { id },
        data: {
          status: item.attemptId ? 'REPLAYING' : 'RESOLVED',
          replayCount: { increment: 1 },
          replayingAt: item.attemptId ? new Date() : null,
          resolvedAt: item.attemptId ? null : new Date(),
          lastErrorCode: null
        }
      });
    });
  }

  discard(id: string, reason: string) {
    return this.prisma.profileCircleNotificationDeadLetter.update({
      where: { id },
      data: {
        status: 'DISCARDED',
        discardedAt: new Date(),
        lastErrorCode: `DISCARDED:${reason.slice(0, 200)}`
      }
    });
  }

  async resolveByAttempt(attemptId: string) {
    const result = await this.prisma.profileCircleNotificationDeadLetter.updateMany({
      where: { attemptId, status: { in: ['OPEN', 'REPLAYING'] } },
      data: { status: 'RESOLVED', resolvedAt: new Date(), lastErrorCode: null }
    });
    return result.count;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/profile-circle-notification-dead-letters')
export class AdminProfileCircleNotificationDeadLetterController {
  constructor(
    private readonly deadLetters: ProfileCircleNotificationDeadLetterService
  ) {}

  @Get()
  list(@Query('status') status?: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 100;
    return this.deadLetters.list({
      status,
      limit: Number.isFinite(parsed) ? parsed : 100
    });
  }

  @Post(':id/replay')
  replay(@Param('id') id: string) {
    return this.deadLetters.replay(id);
  }

  @Post(':id/discard')
  discard(
    @Param('id') id: string,
    @Body() dto: DiscardProfileCircleNotificationDeadLetterDto
  ) {
    return this.deadLetters.discard(id, dto.reason);
  }
}
