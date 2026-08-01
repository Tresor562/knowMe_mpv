import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { MessagingModule } from './messaging/messaging.module';
import { PostsModule } from './posts/posts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MediaModule } from './media/media.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { SocialModule } from './social/social.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ServeStaticModule.forRoot({ rootPath: join(process.cwd(), 'uploads'), serveRoot: '/uploads' }),
    PrismaModule,
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
    SocialModule,
    AccountModule
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
