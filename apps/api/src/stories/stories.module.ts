import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MediaModule } from '../media/media.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryAlbumsController } from './story-albums.controller';
import { StoryAlbumsService } from './story-albums.service';
import { StoryDiscoveryController } from './story-discovery.controller';
import { StoryDiscoveryService } from './story-discovery.service';
import { StoryInteractionNotifier } from './story-interaction-notifier.service';
import { StoryLifecycleService } from './story-lifecycle.service';
import { StoryMediaController } from './story-media.controller';
import { StoryMediaService } from './story-media.service';
import { StoriesController } from './stories.controller';
import { StoriesPremiumBootstrap } from './stories-premium.bootstrap';
import { StoriesService } from './stories.service';

@Module({
  imports: [
    PrismaModule,
    EntitlementsModule,
    MediaModule,
    ModerationModule,
    NotificationsModule,
    ObservabilityModule
  ],
  controllers: [
    StoriesController,
    StoryMediaController,
    StoryDiscoveryController,
    StoryAlbumsController
  ],
  providers: [
    StoriesService,
    StoryMediaService,
    StoryAlbumsService,
    StoryDiscoveryService,
    StoryInteractionNotifier,
    StoryLifecycleService,
    StoriesPremiumBootstrap
  ],
  exports: [StoriesService, StoryAlbumsService, StoryDiscoveryService, StoryLifecycleService]
})
export class StoriesModule {}
