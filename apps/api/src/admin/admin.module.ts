import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/roles.guard';
import { MediaModule } from '../media/media.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [AdminController],
  providers: [AdminService, MediaQuarantineOpsService, RolesGuard]
})
export class AdminModule {}
