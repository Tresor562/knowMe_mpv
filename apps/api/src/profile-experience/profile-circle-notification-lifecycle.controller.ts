import {
  Controller,
  Delete,
  Get,
  Injectable,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type AuthRequest = { user: { userId: string } };

@Injectable()
export class ProfileCircleNotificationLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForUser(userId: string) {
    const [channelPreferences, digestSubscription, endpoints, suppressions, attempts] =
      await Promise.all([
        this.prisma.profileCircleNotificationChannelPreference.findMany({
          where: { userId },
          orderBy: { channel: 'asc' }
        }),
        this.prisma.profileCircleNotificationDigestSubscription.findUnique({
          where: { userId }
        }),
        this.prisma.profileCircleNotificationEndpoint.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            channel: true,
            platform: true,
            locale: true,
            status: true,
            failureCount: true,
            lastSeenAt: true,
            lastSuccessAt: true,
            disabledAt: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        this.prisma.profileCircleNotificationSuppression.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            channel: true,
            reason: true,
            active: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        this.prisma.profileCircleNotificationTransportAttempt.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true,
            channel: true,
            provider: true,
            status: true,
            attempts: true,
            nextAttemptAt: true,
            sentAt: true,
            failedAt: true,
            errorCode: true,
            createdAt: true,
            updatedAt: true
          }
        })
      ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date(),
      channelPreferences,
      digestSubscription,
      endpoints,
      suppressions,
      attempts
    };
  }

  async disableExternalDelivery(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [endpoints, preferences, digest] = await Promise.all([
        tx.profileCircleNotificationEndpoint.updateMany({
          where: { userId, status: 'ACTIVE' },
          data: { status: 'DISABLED', disabledAt: new Date() }
        }),
        Promise.all(
          (['PUSH', 'EMAIL'] as const).map((channel) =>
            tx.profileCircleNotificationChannelPreference.upsert({
              where: { userId_channel: { userId, channel } },
              create: {
                userId,
                channel,
                optionalEnabled: false,
                digestEnabled: false,
                minimumPriority: 'CRITICAL',
                updatedBy: userId
              },
              update: {
                optionalEnabled: false,
                digestEnabled: false,
                minimumPriority: 'CRITICAL',
                updatedBy: userId
              }
            })
          )
        ),
        tx.profileCircleNotificationDigestSubscription.updateMany({
          where: { userId },
          data: {
            weeklyEnabled: false,
            emailEnabled: false,
            pushEnabled: false
          }
        })
      ]);
      return {
        disabledEndpoints: endpoints.count,
        updatedPreferences: preferences.length,
        disabledDigestSubscriptions: digest.count
      };
    });
  }

  async eraseOptionalState(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [preferences, suppressions, deadLetters] = await Promise.all([
        tx.profileCircleNotificationChannelPreference.deleteMany({
          where: { userId }
        }),
        tx.profileCircleNotificationSuppression.deleteMany({ where: { userId } }),
        tx.profileCircleNotificationDeadLetter.updateMany({
          where: { userId, status: { in: ['OPEN', 'REPLAYING'] } },
          data: {
            status: 'DISCARDED',
            discardedAt: new Date(),
            lastErrorCode: 'USER_LIFECYCLE_ERASURE'
          }
        })
      ]);
      return {
        deletedPreferences: preferences.count,
        deletedSuppressions: suppressions.count,
        discardedDeadLetters: deadLetters.count
      };
    });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('profile-circle-notification-lifecycle')
export class ProfileCircleNotificationLifecycleController {
  constructor(
    private readonly lifecycle: ProfileCircleNotificationLifecycleService
  ) {}

  @Get('me/export')
  export(@Req() request: AuthRequest) {
    return this.lifecycle.exportForUser(request.user.userId);
  }

  @Post('me/disable-external-delivery')
  disable(@Req() request: AuthRequest) {
    return this.lifecycle.disableExternalDelivery(request.user.userId);
  }

  @Delete('me/optional-state')
  erase(@Req() request: AuthRequest) {
    return this.lifecycle.eraseOptionalState(request.user.userId);
  }
}
