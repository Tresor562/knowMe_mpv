import { Module } from '@nestjs/common';
import { AdminCreatorsController } from './admin-creators.controller';
import { CreatorMetricsRetentionService } from './creator-metrics-retention.service';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  controllers: [CreatorsController, AdminCreatorsController],
  providers: [CreatorsService, CreatorMetricsRetentionService],
  exports: [CreatorsService, CreatorMetricsRetentionService]
})
export class CreatorsModule {}
