import { Module } from '@nestjs/common';
import { LinkTargetsController } from './link-targets.controller';
import { LinkTargetsService } from './link-targets.service';

@Module({
  controllers: [LinkTargetsController],
  providers: [LinkTargetsService],
  exports: [LinkTargetsService]
})
export class LinkTargetsModule {}
