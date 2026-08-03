import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  NotificationStateActionDto,
  RegisterNotificationPushEndpointDto,
  UpdateNotificationPreferencesDto
} from './dto/notification-center.dto';
import { NotificationCenterService } from './notification-center.service';
import { NotificationsService } from './notifications.service';

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly center: NotificationCenterService
  ) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.notifications.list(req.user.userId);
  }

  @Get('center')
  intelligentCenter(@Req() req: AuthRequest) {
    return this.center.center(req.user.userId);
  }

  @Get('preferences')
  preferences(@Req() req: AuthRequest) {
    return this.center.getPreferences(req.user.userId);
  }

  @Put('preferences')
  updatePreferences(
    @Req() req: AuthRequest,
    @Body() dto: UpdateNotificationPreferencesDto
  ) {
    return this.center.updatePreferences(req.user.userId, dto);
  }

  @Get('push-endpoints')
  pushEndpoints(@Req() req: AuthRequest) {
    return this.center.pushEndpoints(req.user.userId);
  }

  @Post('push-endpoints')
  registerPushEndpoint(
    @Req() req: AuthRequest,
    @Body() dto: RegisterNotificationPushEndpointDto
  ) {
    return this.center.registerPushEndpoint(req.user.userId, dto);
  }

  @Post('push-endpoints/:endpointId/disable')
  disablePushEndpoint(
    @Req() req: AuthRequest,
    @Param('endpointId') endpointId: string
  ) {
    return this.center.disablePushEndpoint(req.user.userId, endpointId);
  }

  @Post(':id/state')
  applyState(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: NotificationStateActionDto
  ) {
    return this.center.applyState(req.user.userId, id, dto);
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthRequest) {
    return this.notifications.unreadCount(req.user.userId);
  }

  @Patch('read-all')
  markAllRead(@Req() req: AuthRequest) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.notifications.markRead(req.user.userId, id);
  }
}
