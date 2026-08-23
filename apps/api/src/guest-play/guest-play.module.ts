import { Module } from '@nestjs/common';
import { GamePlatformModule } from '../games/game-platform.module';
import { GuestGameplayService } from './guest-gameplay.service';
import { GuestPlayController } from './guest-play.controller';
import { GuestPlayService } from './guest-play.service';
import { GuestRetentionService } from './guest-retention.service';

@Module({
  imports: [GamePlatformModule],
  controllers: [GuestPlayController],
  providers: [GuestPlayService, GuestGameplayService, GuestRetentionService],
  exports: [GuestPlayService, GuestGameplayService, GuestRetentionService]
})
export class GuestPlayModule {}
