import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, MediaQuarantineOpsService, RolesGuard]
})
export class AdminModule {}
