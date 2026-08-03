import { Module } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProfileExperienceController } from './profile-experience.controller';
import { ProfileExperienceService } from './profile-experience.service';
import { ProfilePublicService } from './profile-public.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [ProfileExperienceController],
  providers: [
    ProfileExperienceService,
    ProfilePublicService,
    OptionalJwtAuthGuard
  ],
  exports: [ProfileExperienceService, ProfilePublicService]
})
export class ProfileExperienceModule {}
