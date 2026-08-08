import { Module } from '@nestjs/common';
import { CallIceService } from './call-ice.service';
import { CallMaintenanceService } from './call-maintenance.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, CallIceService, CallMaintenanceService],
  exports: [CallsService, CallIceService, CallMaintenanceService]
})
export class CallsModule {}
