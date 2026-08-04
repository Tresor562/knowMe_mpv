import { Module } from '@nestjs/common';
import { AdminGamePlatformController } from './admin-game-platform.controller';
import { AffinityGameController } from './affinity-game.controller';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { GameAccountLifecycleService } from './game-account-lifecycle.service';
import { GameEngineRegistry } from './game-engine.registry';
import { GamePlatformController } from './game-platform.controller';
import { GamePlatformService } from './game-platform.service';
import { GameSessionMaintenanceService } from './game-session-maintenance.service';

@Module({
  controllers: [
    GamePlatformController,
    AffinityGameController,
    AdminGamePlatformController
  ],
  providers: [
    GameEngineRegistry,
    AffinityGamePolicyService,
    GamePlatformService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ],
  exports: [
    AffinityGamePolicyService,
    GamePlatformService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ]
})
export class GamePlatformModule {}
