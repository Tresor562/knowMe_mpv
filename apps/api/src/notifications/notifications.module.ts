import { forwardRef, Global, Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationCenterDigestSchedulerService } from './notification-center-digest-scheduler.service';
import { NotificationCenterDigestService } from './notification-center-digest.service';
import { AdminNotificationCenterOperationsController } from './notification-center-operations.controller';
import { NotificationCenterPolicyService } from './notification-center-policy.service';
import { NotificationCenterService } from './notification-center.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [
    NotificationsController,
    AdminNotificationCenterOperationsController
  ],
  providers: [
    NotificationsService,
    NotificationCenterPolicyService,
    NotificationCenterService,
    NotificationCenterDigestService,
    NotificationCenterDigestSchedulerService
  ],
  exports: [
    NotificationsService,
    NotificationCenterPolicyService,
    NotificationCenterService,
    NotificationCenterDigestService
  ]
})
export class NotificationsModule {}
