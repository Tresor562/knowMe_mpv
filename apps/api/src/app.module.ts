import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import './compat/nest-too-many-requests';
import { AccessControlModule } from './access-control/access-control.module';
import { AccountModule } from './account/account.module';
import { AchievementsModule } from './achievements/achievements.module';
import { AdminModule } from './admin/admin.module';
import { AppearanceModule } from './appearance/appearance.module';
import { AvatarStudioModule } from './avatar-studio/avatar-studio.module';
import { AvatarUniverseModule } from './avatar-universe/avatar-universe.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChallengesModule } from './challenges/challenges.module';
import { CommunitiesModule } from './communities/communities.module';
import { ConceptKModule } from './concept-k/concept-k.module';
import { ConversationDraftsModule } from './conversation-drafts/conversation-drafts.module';
import { CosmeticsModule } from './cosmetics/cosmetics.module';
import { CreatorsModule } from './creators/creators.module';
import { DailyChestModule } from './daily-chest/daily-chest.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { GamePlatformModule } from './games/game-platform.module';
import { GiftExchangeModule } from './gift-exchange/gift-exchange.module';
import { HealthController } from './health.controller';
import { I18nModule } from './i18n/i18n.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { IntegrityModule } from './integrity/integrity.module';
import { KnowMeSecretModule } from './knowme-secret/knowme-secret.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { MediaModule } from './media/media.module';
import { MessengerExperienceModule } from './messenger-experience/messenger-experience.module';
import { MessagingModule } from './messaging/messaging.module';
import { ModerationModule } from './moderation/moderation.module';
import { NexusIntegrationModule } from './nexus-integration/nexus-integration.module';
import { NexusSocialModule } from './nexus-social/nexus-social.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { PaymentsModule } from './payments/payments.module';
import { PositiveChallengesModule } from './positive-challenges/positive-challenges.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ProfileExperienceModule } from './profile-experience/profile-experience.module';
import { ProgressionModule } from './progression/progression.module';
import { PurchasesModule } from './purchases/purchases.module';
import { QuestsModule } from './quests/quests.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule } from './reports/reports.module';
import { RewardsModule } from './rewards/rewards.module';
import { SavedMessagesModule } from './saved-messages/saved-messages.module';
import { SearchModule } from './search/search.module';
import { ShortLinksModule } from './short-links/short-links.module';
import { SocialMatchmakingModule } from './social-matchmaking/social-matchmaking.module';
import { SocialModule } from './social/social.module';
import { StaffModule } from './staff/staff.module';
import { StreaksModule } from './streaks/streaks.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads'
    }),
    PrismaModule,
    ObservabilityModule,
    I18nModule,
    AccessControlModule,
    ModerationModule,
    WalletModule,
    RewardsModule,
    ProgressionModule,
    StreaksModule,
    QuestsModule,
    AchievementsModule,
    LeaderboardsModule,
    DailyChestModule,
    PositiveChallengesModule,
    ConceptKModule,
    ProfileExperienceModule,
    CosmeticsModule,
    AvatarStudioModule,
    AvatarUniverseModule,
    GiftExchangeModule,
    MessengerExperienceModule,
    CommunitiesModule,
    CreatorsModule,
    GamePlatformModule,
    SocialMatchmakingModule,
    KnowMeSecretModule,
    AppearanceModule,
    BillingModule,
    PaymentsModule,
    VerificationModule,
    AuthModule,
    UsersModule,
    ChallengesModule,
    MessagingModule,
    SavedMessagesModule,
    ConversationDraftsModule,
    PostsModule,
    SearchModule,
    NotificationsModule,
    AdminModule,
    RealtimeModule,
    MediaModule,
    IntelligenceModule,
    IntegrityModule,
    PurchasesModule,
    SocialModule,
    ShortLinksModule,
    AccountModule,
    PrivacyModule,
    ReportsModule,
    FeatureFlagsModule,
    EntitlementsModule,
    StaffModule,
    NexusIntegrationModule,
    NexusSocialModule
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
