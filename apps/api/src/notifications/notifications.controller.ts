import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  NotificationCenterStateActionDto,
  UpdateNotificationCenterPreferencesDto
} from './dto/notification-center.dto';
import { NotificationCenterView } from './notification-center.domain';
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
  async list(@Req() request: AuthRequest) {
    const result = await this.center.center({
      userId: request.user.userId,
      view: 'ACTIVE',
      limit: 50
    });
    return result.items;
  }

  @Get('center')
  intelligentCenter(
    @Req() request: AuthRequest,
    @Query('view') view?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.center.center({
      userId: request.user.userId,
      view: this.view(view),
      cursor: cursor?.trim() || undefined,
      limit: this.limit(limit)
    });
  }

  @Get('preferences')
  preferences(@Req() request: AuthRequest) {
    return this.center.getPreferences(request.user.userId);
  }

  @Put('preferences')
  updatePreferences(
    @Req() request: AuthRequest,
    @Body() dto: UpdateNotificationCenterPreferencesDto
  ) {
    return this.center.updatePreferences(request.user.userId, dto);
  }

  @Get('unread-count')
  unreadCount(@Req() request: AuthRequest) {
    return this.center.unreadCount(request.user.userId);
  }

  @Patch('read-all')
  markAllRead(@Req() request: AuthRequest) {
    return this.center.markAllVisibleRead(request.user.userId);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: AuthRequest,
    @Param('id') id: string
  ) {
    return this.notifications.markRead(request.user.userId, id);
  }

  @Post(':id/state')
  applyState(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() dto: NotificationCenterStateActionDto
  ) {
    return this.center.applyState(request.user.userId, id, dto);
  }

  private view(value?: string): NotificationCenterView {
    return ['ACTIVE', 'ARCHIVED', 'SNOOZED', 'DISMISSED'].includes(
      value ?? ''
    )
      ? (value as NotificationCenterView)
      : 'ACTIVE';
  }

  private limit(value?: string) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed)
      ? Math.min(100, Math.max(1, parsed))
      : 40;
  }
}
