import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { ProgressionModule } from '../progression/progression.module';
import { QuestsModule } from '../quests/quests.module';
import { StreaksModule } from '../streaks/streaks.module';
import { ChallengeProgressionInterceptor } from './challenge-progression.interceptor';
import { ChallengeResultsService } from './challenge-results.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [
    ProgressionModule,
    StreaksModule,
    QuestsModule,
    AchievementsModule
  ],
  controllers: [ChallengesController],
  providers: [
    ChallengesService,
    ChallengeResultsService,
    ChallengeProgressionInterceptor
  ],
  exports: [ChallengeResultsService]
})
export class ChallengesModule {}
