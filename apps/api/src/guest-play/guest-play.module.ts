import { Module } from '@nestjs/common';
import { GuestPlayController } from './guest-play.controller';
import { GuestPlayService } from './guest-play.service';
import { GuestRetentionService } from './guest-retention.service';

@Module({
  controllers: [GuestPlayController],
  providers: [GuestPlayService, GuestRetentionService],
  exports: [GuestPlayService, GuestRetentionService]
})
export class GuestPlayModule {}
