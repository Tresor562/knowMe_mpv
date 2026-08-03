import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller('profile-circle-notification-delivery')
export class ProfileCircleNotificationDeliveryController {
  constructor(
    private readonly delivery: ProfileCircleNotificationDeliveryService
  ) {}

  @Post('me/flush')
  flushMine(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 300;
    return this.delivery.flushDue({
      userId: req.user.userId,
      limit: Number.isFinite(parsed) ? parsed : 300
    });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
@Controller('admin/profile-circle-notification-delivery')
export class AdminProfileCircleNotificationDeliveryController {
  constructor(
    private readonly delivery: ProfileCircleNotificationDeliveryService
  ) {}

  @Get('health')
  health() {
    return this.delivery.health();
  }

  @Post('flush')
  flush(@Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 500;
    return this.delivery.flushDue({
      limit: Number.isFinite(parsed) ? parsed : 500
    });
  }

  @Post('retry-failed')
  async retryFailed(@Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 300;
    const reset = await this.delivery.retryFailed({
      limit: Number.isFinite(parsed) ? parsed : 300
    });
    const flush = await this.delivery.flushDue({
      limit: Number.isFinite(parsed) ? parsed : 300
    });
    return { reset, flush };
  }
}
