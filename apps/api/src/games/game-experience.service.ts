import { Injectable } from '@nestjs/common';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { AffinityReplayPrivacyService } from './affinity-replay-privacy.service';
import { CreateGameSessionDto } from './dto/create-game-session.dto';
import { GamePlatformService } from './game-platform.service';

@Injectable()
export class GameExperienceService {
  constructor(
    private readonly games: GamePlatformService,
    private readonly affinityPolicy: AffinityGamePolicyService,
    private readonly affinityReplay: AffinityReplayPrivacyService
  ) {}

  async create(userId: string, dto: CreateGameSessionDto) {
    if (dto.gameKey === 'affinity-mirror') {
      await this.affinityPolicy.assertCanInviteByUsernames(
        userId,
        dto.opponentUsernames
      );
    }
    return this.games.create(userId, dto);
  }

  async replay(userId: string, sessionId: string) {
    return this.affinityReplay.sanitize(
      await this.games.replay(userId, sessionId)
    );
  }
}
