import { Module } from '@nestjs/common';
import { AdminGamePlatformController } from './admin-game-platform.controller';
import { GameAccountLifecycleService } from './game-account-lifecycle.service';
import { GameEngineRegistry } from './game-engine.registry';
import { GamePlatformController } from './game-platform.controller';
import { GamePlatformService } from './game-platform.service';
import { GameSessionMaintenanceService } from './game-session-maintenance.service';

@Module({
  controllers: [GamePlatformController, AdminGamePlatformController],
  providers: [
    GameEngineRegistry,
    GamePlatformService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ],
  exports: [
    GamePlatformService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ]
})
export class GamePlatformModule {}
