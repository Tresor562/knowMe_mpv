import { Module } from '@nestjs/common';
import { AppearanceModule } from '../appearance/appearance.module';
import { CallsModule } from '../calls/calls.module';
import { ConceptKModule } from '../concept-k/concept-k.module';
import { CosmeticsModule } from '../cosmetics/cosmetics.module';
import { CreatorsModule } from '../creators/creators.module';
import { GamePlatformModule } from '../games/game-platform.module';
import { MediaModule } from '../media/media.module';
import { NexusSocialModule } from '../nexus-social/nexus-social.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { SecurityModule } from '../security/security.module';
import { SocialMatchmakingModule } from '../social-matchmaking/social-matchmaking.module';
import { SocialModule } from '../social/social.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [
    SecurityModule,
    CallsModule,
    PrivacyModule,
    MediaModule,
    CreatorsModule,
    GamePlatformModule,
    SocialMatchmakingModule,
    ConceptKModule,
    CosmeticsModule,
    AppearanceModule,
    SocialModule,
    NexusSocialModule
  ],
  controllers: [AccountController],
  providers: [AccountService]
})
export class AccountModule {}
