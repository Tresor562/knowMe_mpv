import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProfileCircleController } from './profile-circle.controller';
import { ProfileCircleGovernanceController } from './profile-circle-governance.controller';
import { ProfileCircleGovernanceService } from './profile-circle-governance.service';
import { ProfileCircleService } from './profile-circle.service';
import { ProfileExperienceController } from './profile-experience.controller';
import { ProfileExperienceService } from './profile-experience.service';
import { ProfilePublicService } from './profile-public.service';
import { ProfileStatsController } from './profile-stats.controller';
import { ProfileStatsService } from './profile-stats.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [
    ProfileExperienceController,
    ProfileCircleController,
    ProfileCircleGovernanceController,
    ProfileStatsController
  ],
  providers: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService,
    ProfileCircleGovernanceService,
    ProfileStatsService,
    OptionalJwtAuthGuard
  ],
  exports: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService,
    ProfileCircleGovernanceService,
    ProfileStatsService
  ]
})
export class ProfileExperienceModule {}
