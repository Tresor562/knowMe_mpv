import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard';
import {
  AdminEntitlementsController,
  EntitlementsController,
  ExclusiveFeaturesController
} from './entitlements.controller';
import { EntitlementsGuard } from './entitlements.guard';
import { EntitlementsService } from './entitlements.service';

@Module({
  controllers: [
    EntitlementsController,
    AdminEntitlementsController,
    ExclusiveFeaturesController
  ],
  providers: [EntitlementsService, EntitlementsGuard, RolesGuard],
  exports: [EntitlementsService, EntitlementsGuard]
})
export class EntitlementsModule {}
