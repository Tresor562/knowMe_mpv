import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RolesGuard } from '../common/roles.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, RolesGuard]
})
export class AdminModule {}
