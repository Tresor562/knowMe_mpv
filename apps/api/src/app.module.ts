import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import './compat/nest-too-many-requests';
import { AccessControlModule } from './access-control/access-control.module';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChallengesModule } from './challenges/challenges.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { HealthController } from './health.controller';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { IntegrityModule } from './integrity/integrity.module';
import { MediaModule } from './media/media.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { RequestContextMiddleware } from './observability/request-context.middleware';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportsModule } from './reports/reports.module';
import { RewardsModule } from './rewards/rewards.module';
import { SocialModule } from './social/social.module';
import { StaffModule } from './staff/staff.module';
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
    AccessControlModule,
    WalletModule,
    RewardsModule,
    BillingModule,
    VerificationModule,
    AuthModule,
    UsersModule,
    ChallengesModule,
    MessagingModule,
    PostsModule,
    NotificationsModule,
    AdminModule,
    RealtimeModule,
    MediaModule,
    IntelligenceModule,
    IntegrityModule,
    PurchasesModule,
    SocialModule,
    AccountModule,
    PrivacyModule,
    ReportsModule,
    FeatureFlagsModule,
    EntitlementsModule,
    StaffModule
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
