import { Module } from '@nestjs/common';
import {
  AchievementsController,
  AdminAchievementsController
} from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Module({
  controllers: [AchievementsController, AdminAchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService]
})
export class AchievementsModule {}
