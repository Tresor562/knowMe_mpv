import { Module } from '@nestjs/common';
import { ProgressionController } from './progression.controller';
import { ProgressionService } from './progression.service';

@Module({
  controllers: [ProgressionController],
  providers: [ProgressionService],
  exports: [ProgressionService]
})
export class ProgressionModule {}
