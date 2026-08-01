import { Global, Module } from '@nestjs/common';
import { AdminRewardsController, RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Global()
@Module({
  controllers: [RewardsController, AdminRewardsController],
  providers: [RewardsService],
  exports: [RewardsService]
})
export class RewardsModule {}
