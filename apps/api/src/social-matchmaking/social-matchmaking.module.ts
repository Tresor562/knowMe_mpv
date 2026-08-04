import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AdminSocialMatchmakingController } from './admin-social-matchmaking.controller';
import { SocialMatchmakingController } from './social-matchmaking.controller';
import { SocialMatchmakingMaintenanceService } from './social-matchmaking-maintenance.service';
import { SocialMatchmakingService } from './social-matchmaking.service';

@Module({
  imports: [NotificationsModule, ObservabilityModule],
  controllers: [
    SocialMatchmakingController,
    AdminSocialMatchmakingController
  ],
  providers: [
    SocialMatchmakingService,
    SocialMatchmakingMaintenanceService
  ],
  exports: [
    SocialMatchmakingService,
    SocialMatchmakingMaintenanceService
  ]
})
export class SocialMatchmakingModule {}
