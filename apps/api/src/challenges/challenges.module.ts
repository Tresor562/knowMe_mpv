import { Module } from '@nestjs/common';
import { ProgressionModule } from '../progression/progression.module';
import { ChallengeResultsService } from './challenge-results.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [ProgressionModule],
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeResultsService],
  exports: [ChallengeResultsService]
})
export class ChallengesModule {}
