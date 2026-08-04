import { Module } from '@nestjs/common';
import { AdminGamePlatformController } from './admin-game-platform.controller';
import { GameEngineRegistry } from './game-engine.registry';
import { GamePlatformController } from './game-platform.controller';
import { GamePlatformService } from './game-platform.service';
import { GameSessionMaintenanceService } from './game-session-maintenance.service';

@Module({
  controllers: [GamePlatformController, AdminGamePlatformController],
  providers: [
    GameEngineRegistry,
    GamePlatformService,
    GameSessionMaintenanceService
  ],
  exports: [GamePlatformService, GameSessionMaintenanceService]
})
export class GamePlatformModule {}
