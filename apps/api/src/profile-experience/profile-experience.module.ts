import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProfileCircleController } from './profile-circle.controller';
import { ProfileCircleService } from './profile-circle.service';
import { ProfileExperienceController } from './profile-experience.controller';
import { ProfileExperienceService } from './profile-experience.service';
import { ProfilePublicService } from './profile-public.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [ProfileExperienceController, ProfileCircleController],
  providers: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService,
    OptionalJwtAuthGuard
  ],
  exports: [
    ProfileExperienceService,
    ProfilePublicService,
    ProfileCircleService
  ]
})
export class ProfileExperienceModule {}
