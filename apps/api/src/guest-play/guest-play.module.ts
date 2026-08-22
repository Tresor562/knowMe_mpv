import { Module } from '@nestjs/common';
import { GuestPlayController } from './guest-play.controller';
import { GuestPlayService } from './guest-play.service';

@Module({
  controllers: [GuestPlayController],
  providers: [GuestPlayService],
  exports: [GuestPlayService]
})
export class GuestPlayModule {}
