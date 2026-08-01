import { Global, Module } from '@nestjs/common';
import {
  AccessController,
  AdminAccessControlController
} from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  controllers: [AccessController, AdminAccessControlController],
  providers: [AccessControlService, PermissionsGuard],
  exports: [AccessControlService, PermissionsGuard]
})
export class AccessControlModule {}
