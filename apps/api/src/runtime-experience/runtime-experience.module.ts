import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { RuntimeExperienceController, AdminRuntimeExperienceController } from './runtime-experience.controller';
import { RuntimeExperienceService } from './runtime-experience.service';

@Module({
  imports: [RealtimeModule],
  controllers: [RuntimeExperienceController, AdminRuntimeExperienceController],
  providers: [RuntimeExperienceService]
})
export class RuntimeExperienceModule {}
