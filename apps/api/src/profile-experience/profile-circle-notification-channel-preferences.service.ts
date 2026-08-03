import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';
import {
  priorityAtLeast,
  ProfileCircleNotificationPriority
} from './profile-circle-notification-resilience.domain';

class UpdateProfileCircleNotificationChannelPreferenceDto {
  @IsIn(['PUSH', 'EMAIL'])
  channel!: ProfileCircleTransportChannel;

  @IsBoolean()
  optionalEnabled!: boolean;

  @IsBoolean()
  digestEnabled!: boolean;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  minimumPriority!: ProfileCircleNotificationPriority;
}

type AuthRequest = { user: { userId: string } };

@Injectable()
export class ProfileCircleNotificationChannelPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const stored = await this.prisma.profileCircleNotificationChannelPreference.findMany({
      where: { userId },
      orderBy: { channel: 'asc' }
    });
    const byChannel = new Map(stored.map((item) => [item.channel, item]));
    return (['EMAIL', 'PUSH'] as const).map((channel) => {
      const current = byChannel.get(channel);
      return {
        channel,
        optionalEnabled: current?.optionalEnabled ?? true,
        digestEnabled: current?.digestEnabled ?? true,
        minimumPriority: current?.minimumPriority ?? 'LOW',
        updatedAt: current?.updatedAt ?? null
      };
    });
  }

  update(
    userId: string,
    input: UpdateProfileCircleNotificationChannelPreferenceDto
  ) {
    return this.prisma.profileCircleNotificationChannelPreference.upsert({
      where: { userId_channel: { userId, channel: input.channel } },
      create: {
        userId,
        channel: input.channel,
        optionalEnabled: input.optionalEnabled,
        digestEnabled: input.digestEnabled,
        minimumPriority: input.minimumPriority,
        updatedBy: userId
      },
      update: {
        optionalEnabled: input.optionalEnabled,
        digestEnabled: input.digestEnabled,
        minimumPriority: input.minimumPriority,
        updatedBy: userId
      },
      select: {
        channel: true,
        optionalEnabled: true,
        digestEnabled: true,
        minimumPriority: true,
        updatedAt: true
      }
    });
  }

  async allows(input: {
    userId: string;
    channel: ProfileCircleTransportChannel;
    priority: ProfileCircleNotificationPriority;
    digest?: boolean;
    mandatory?: boolean;
  }) {
    if (input.mandatory || input.priority === 'CRITICAL') return true;
    const preference =
      await this.prisma.profileCircleNotificationChannelPreference.findUnique({
        where: {
          userId_channel: { userId: input.userId, channel: input.channel }
        }
      });
    if (!preference) return true;
    if (!preference.optionalEnabled) return false;
    if (input.digest && !preference.digestEnabled) return false;
    return priorityAtLeast(input.priority, preference.minimumPriority);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('profile-circle-notification-channel-preferences')
export class ProfileCircleNotificationChannelPreferencesController {
  constructor(
    private readonly preferences: ProfileCircleNotificationChannelPreferencesService
  ) {}

  @Get('me')
  list(@Req() request: AuthRequest) {
    return this.preferences.list(request.user.userId);
  }

  @Post('me')
  update(
    @Req() request: AuthRequest,
    @Body() dto: UpdateProfileCircleNotificationChannelPreferenceDto
  ) {
    return this.preferences.update(request.user.userId, dto);
  }
}
