import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/roles.guard';
import { MediaModule } from '../media/media.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';
import { MediaQuarantineRetryWorkerService } from './media-quarantine-retry-worker.service';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    MediaQuarantineOpsService,
    MediaQuarantineRetryWorkerService,
    RolesGuard
  ]
})
export class AdminModule {}
