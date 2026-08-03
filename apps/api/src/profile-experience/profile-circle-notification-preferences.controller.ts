import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileCircleNotificationPreferenceDto } from './dto/profile-circle-notification-preferences.dto';
import { ProfileCircleNotificationPreferencesService } from './profile-circle-notification-preferences.service';

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller('profile-circle-notification-preferences')
export class ProfileCircleNotificationPreferencesController {
  constructor(
    private readonly preferences: ProfileCircleNotificationPreferencesService
  ) {}

  @Get('me')
  me(@Req() req: AuthRequest) {
    return this.preferences.get(req.user.userId);
  }

  @Put('me')
  update(
    @Req() req: AuthRequest,
    @Body() dto: UpdateProfileCircleNotificationPreferenceDto
  ) {
    return this.preferences.update(req.user.userId, dto);
  }

  @Put('me/circles/:circleId/mute')
  mute(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    return this.preferences.muteCircle(req.user.userId, circleId, true);
  }

  @Put('me/circles/:circleId/unmute')
  unmute(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    return this.preferences.muteCircle(req.user.userId, circleId, false);
  }
}
