import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryDiscoveryController } from './story-discovery.controller';
import { StoryDiscoveryService } from './story-discovery.service';
import { StoriesController } from './stories.controller';
import { StoriesPremiumBootstrap } from './stories-premium.bootstrap';
import { StoriesService } from './stories.service';

@Module({
  imports: [PrismaModule, EntitlementsModule, ModerationModule, ObservabilityModule],
  controllers: [StoriesController, StoryDiscoveryController],
  providers: [StoriesService, StoryDiscoveryService, StoriesPremiumBootstrap],
  exports: [StoriesService, StoryDiscoveryService]
})
export class StoriesModule {}
