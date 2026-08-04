import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AdminSocialMatchmakingController } from './admin-social-matchmaking.controller';
import { SocialConnectionService } from './social-connection.service';
import { SocialMatchmakingController } from './social-matchmaking.controller';
import { SocialMatchmakingGovernanceService } from './social-matchmaking-governance.service';
import { SocialMatchmakingMaintenanceService } from './social-matchmaking-maintenance.service';
import { SocialMatchmakingService } from './social-matchmaking.service';

@Module({
  imports: [NotificationsModule, ObservabilityModule],
  controllers: [
    SocialMatchmakingController,
    AdminSocialMatchmakingController
  ],
  providers: [
    {
      provide: SocialMatchmakingService,
      useClass: SocialMatchmakingGovernanceService
    },
    SocialConnectionService,
    SocialMatchmakingMaintenanceService
  ],
  exports: [
    SocialMatchmakingService,
    SocialConnectionService,
    SocialMatchmakingMaintenanceService
  ]
})
export class SocialMatchmakingModule {}
