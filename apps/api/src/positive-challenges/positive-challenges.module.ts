import { Module } from '@nestjs/common';
import { PositiveChallengesController } from './positive-challenges.controller';
import { PositiveChallengesService } from './positive-challenges.service';

@Module({
  controllers: [PositiveChallengesController],
  providers: [PositiveChallengesService],
  exports: [PositiveChallengesService]
})
export class PositiveChallengesModule {}
