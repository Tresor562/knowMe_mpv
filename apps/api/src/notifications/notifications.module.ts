import { forwardRef, Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationCenterService } from './notification-center.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationCenterService],
  exports: [NotificationsService, NotificationCenterService]
})
export class NotificationsModule {}
