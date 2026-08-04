import { Module } from '@nestjs/common';
import { CallMaintenanceService } from './call-maintenance.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, CallMaintenanceService],
  exports: [CallsService, CallMaintenanceService]
})
export class CallsModule {}
