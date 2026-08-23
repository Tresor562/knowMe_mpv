import { Module } from '@nestjs/common';
import { AdminGamePlatformController } from './admin-game-platform.controller';
import { AdminTournamentController } from './admin-tournament.controller';
import { AffinityGameController } from './affinity-game.controller';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { AffinityReplayPrivacyService } from './affinity-replay-privacy.service';
import { GameAccountLifecycleService } from './game-account-lifecycle.service';
import { GameCatalogController } from './game-catalog.controller';
import { GameCatalogService } from './game-catalog.service';
import { GameEngineRegistry } from './game-engine.registry';
import { GameExperienceService } from './game-experience.service';
import { GamePlatformController } from './game-platform.controller';
import { GamePlatformService } from './game-platform.service';
import { GameSessionMaintenanceService } from './game-session-maintenance.service';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';

@Module({
  controllers: [
    GamePlatformController,
    GameCatalogController,
    AffinityGameController,
    TournamentController,
    AdminGamePlatformController,
    AdminTournamentController
  ],
  providers: [
    GameEngineRegistry,
    GameCatalogService,
    AffinityGamePolicyService,
    AffinityReplayPrivacyService,
    GamePlatformService,
    GameExperienceService,
    TournamentService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ],
  exports: [
    GameEngineRegistry,
    AffinityGamePolicyService,
    GameCatalogService,
    GamePlatformService,
    GameExperienceService,
    TournamentService,
    GameAccountLifecycleService,
    GameSessionMaintenanceService
  ]
})
export class GamePlatformModule {}
