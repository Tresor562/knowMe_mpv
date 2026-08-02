import { Global, Module } from '@nestjs/common';
import {
  AdminExperienceController,
  ExperienceController
} from './experience.controller';
import { ExperienceService } from './experience.service';

@Global()
@Module({
  controllers: [ExperienceController, AdminExperienceController],
  providers: [ExperienceService],
  exports: [ExperienceService]
})
export class ExperienceModule {}
