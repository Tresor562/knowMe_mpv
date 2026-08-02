import { Module } from '@nestjs/common';
import { ChallengeResultsService } from './challenge-results.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeResultsService],
  exports: [ChallengeResultsService]
})
export class ChallengesModule {}
