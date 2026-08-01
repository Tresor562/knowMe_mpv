import { Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.notifications.list(req.user.userId);
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: { userId: string } }) {
    return this.notifications.markAllRead(req.user.userId);
  }
}
