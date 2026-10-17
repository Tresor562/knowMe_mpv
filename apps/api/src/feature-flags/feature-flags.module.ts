import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  AdminFeatureFlagsController,
  FeatureFlagsController
} from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';

@Global()
@Module({
  imports: [RealtimeModule],
  controllers: [FeatureFlagsController, AdminFeatureFlagsController],
  providers: [FeatureFlagsService, RolesGuard],
  exports: [FeatureFlagsService]
})
export class FeatureFlagsModule {}
