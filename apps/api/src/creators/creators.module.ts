import { Module } from '@nestjs/common';
import { AdminCreatorsController } from './admin-creators.controller';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  controllers: [CreatorsController, AdminCreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService]
})
export class CreatorsModule {}
