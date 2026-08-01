import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import {
  AdminFeatureFlagsController,
  FeatureFlagsController
} from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';

@Global()
@Module({
  controllers: [FeatureFlagsController, AdminFeatureFlagsController],
  providers: [FeatureFlagsService, RolesGuard],
  exports: [FeatureFlagsService]
})
export class FeatureFlagsModule {}
