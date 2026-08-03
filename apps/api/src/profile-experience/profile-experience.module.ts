import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProfileCircleController } from './profile-circle.controller';
import { ProfileCircleEmailDigestService, ProfileCircleHttpEmailProvider } from './profile-circle-email-digest.service';
import { ProfileCircleNotificationEndpointsService } from './profile-circle-notification-endpoints.service';
import {
  AdminProfileCircleNotificationDeliveryController,
  ProfileCircleNotificationDeliveryController
} from './profile-circle-notification-delivery.controller';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';
import { ProfileCircleNotificationLeaseService } from './profile-circle-notification-lease.service';
import {
  AdminProfileCircleNotificationOperationsController,
  ProfileCircleNotificationEndpointsController
} from './profile-circle-notification-operations.controller';
import { ProfileCircleNotificationRuntimeConfigService } from './profile-circle-notification-runtime.config';
import { ProfileCircleNotificationSchedulerService } from './profile-circle-notification-scheduler.service';
import { ProfileCircleNotificationTelemetryService } from './profile-circle-notification-telemetry.service';
import { ProfileCircleHttpPushProvider, ProfileCirclePushDeliveryService } from './profile-circle-push-delivery.service';
import { ProfileCircleWeeklyDigestService } from './profile-circle-weekly-digest.service';
import { ProfileCircleGovernanceController } from './profile-circle-governance.controller';
import { ProfileCircleGovernanceService } from './profile-circle-governance.service';
import { ProfileCircleNotificationPreferencesController } from './profile-circle-notification-preferences.controller';
import { ProfileCircleNotificationPreferencesService } from './profile-circle-notification-preferences.service';
import { ProfileCircleNotificationsService } from './profile-circle-notifications.service';
import { ProfileCircleService } from './profile-circle.service';
import { ProfileExperienceController } from './profile-experience.controller';
import { ProfileExperienceService } from './profile-experience.service';
import { ProfileMemberDirectoryController } from './profile-member-directory.controller';
import { ProfileMemberDirectoryService } from './profile-member-directory.service';
import { ProfilePublicService } from './profile-public.service';
import { ProfileStatsController } from './profile-stats.controller';
import { ProfileStatsService } from './profile-stats.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [
    ProfileExperienceController,
    ProfileCircleController,
    ProfileCircleGovernanceController,
    ProfileCircleNotificationPreferencesController,
    ProfileCircleNotificationDeliveryController,
    AdminProfileCircleNotificationDeliveryController,
    ProfileCircleNotificationEndpointsController,
    AdminProfileCircleNotificationOperationsController,
    ProfileMemberDirectoryController,
    ProfileStatsController
  ],
  providers: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService,
    ProfileCircleGovernanceService,
    ProfileCircleNotificationPreferencesService,
    ProfileCircleNotificationsService,
    ProfileCircleNotificationDeliveryService,
    ProfileCircleNotificationRuntimeConfigService,
    ProfileCircleNotificationLeaseService,
    ProfileCircleNotificationSchedulerService,
    ProfileCircleNotificationEndpointsService,
    ProfileCircleHttpPushProvider,
    ProfileCirclePushDeliveryService,
    ProfileCircleHttpEmailProvider,
    ProfileCircleEmailDigestService,
    ProfileCircleWeeklyDigestService,
    ProfileCircleNotificationTelemetryService,
    ProfileMemberDirectoryService,
    ProfileStatsService,
    OptionalJwtAuthGuard
  ],
  exports: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService,
    ProfileCircleGovernanceService,
    ProfileCircleNotificationPreferencesService,
    ProfileCircleNotificationsService,
    ProfileCircleNotificationDeliveryService,
    ProfileCircleNotificationEndpointsService,
    ProfileCirclePushDeliveryService,
    ProfileCircleEmailDigestService,
    ProfileCircleWeeklyDigestService,
    ProfileMemberDirectoryService,
    ProfileStatsService
  ]
})
export class ProfileExperienceModule {}
