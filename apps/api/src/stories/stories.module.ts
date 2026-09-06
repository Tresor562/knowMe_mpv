import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryDiscoveryController } from './story-discovery.controller';
import { StoryDiscoveryService } from './story-discovery.service';
import { StoryInteractionNotifier } from './story-interaction-notifier.service';
import { StoryLifecycleService } from './story-lifecycle.service';
import { StoriesController } from './stories.controller';
import { StoriesPremiumBootstrap } from './stories-premium.bootstrap';
import { StoriesService } from './stories.service';

@Module({
  imports: [
    PrismaModule,
    EntitlementsModule,
    ModerationModule,
    NotificationsModule,
    ObservabilityModule
  ],
  controllers: [StoriesController, StoryDiscoveryController],
  providers: [
    StoriesService,
    StoryDiscoveryService,
    StoryInteractionNotifier,
    StoryLifecycleService,
    StoriesPremiumBootstrap
  ],
  exports: [StoriesService, StoryDiscoveryService, StoryLifecycleService]
})
export class StoriesModule {}
