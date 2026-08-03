import {
  Body,
  Controller,
  Delete,
  Get,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';
import {
  ProfileCircleNotificationEndpointsService,
  ProfileCircleTransportChannel
} from './profile-circle-notification-endpoints.service';
import { ProfileCircleNotificationLeaseService } from './profile-circle-notification-lease.service';
import { ProfileCircleNotificationSchedulerService } from './profile-circle-notification-scheduler.service';
import { ProfileCircleNotificationTelemetryService } from './profile-circle-notification-telemetry.service';
import { ProfileCircleWeeklyDigestService } from './profile-circle-weekly-digest.service';

class RegisterProfileCircleNotificationEndpointDto {
  @IsEnum(['PUSH', 'EMAIL'])
  channel!: ProfileCircleTransportChannel;

  @IsString()
  @MaxLength(4096)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller('profile-circle-notification-endpoints')
export class ProfileCircleNotificationEndpointsController {
  constructor(
    private readonly endpoints: ProfileCircleNotificationEndpointsService
  ) {}

  @Post('me')
  register(
    @Req() request: AuthRequest,
    @Body() dto: RegisterProfileCircleNotificationEndpointDto
  ) {
    return this.endpoints.register({ userId: request.user.userId, ...dto });
  }

  @Delete('me/:endpointId')
  disable(
    @Req() request: AuthRequest,
    @Param('endpointId') endpointId: string
  ) {
    return this.endpoints.disable(request.user.userId, endpointId);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/profile-circle-notification-operations')
export class AdminProfileCircleNotificationOperationsController {
  constructor(
    private readonly delivery: ProfileCircleNotificationDeliveryService,
    private readonly scheduler: ProfileCircleNotificationSchedulerService,
    private readonly leases: ProfileCircleNotificationLeaseService,
    private readonly weekly: ProfileCircleWeeklyDigestService,
    private readonly telemetry: ProfileCircleNotificationTelemetryService
  ) {}

  @Get('dashboard')
  async dashboard() {
    const [delivery, lease] = await Promise.all([
      this.delivery.health(),
      this.leases.status('profile-circle-notification-delivery')
    ]);
    return {
      delivery,
      scheduler: this.scheduler.status(),
      lease,
      telemetry: this.telemetry.snapshot(),
      serverTime: new Date()
    };
  }

  @Post('scheduler/tick')
  tick() {
    return this.scheduler.tick();
  }

  @Post('weekly-digest/flush')
  flushWeeklyDigest() {
    return this.weekly.flushDue();
  }
}
