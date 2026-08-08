import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NexusEntitlementService } from './nexus-entitlement.service';
import { NexusSocialController } from './nexus-social.controller';
import { NexusSocialLifecycleService } from './nexus-social-lifecycle.service';
import { NexusSocialPrivacyService } from './nexus-social-privacy.service';
import { NexusSocialService } from './nexus-social.service';

@Module({
  imports: [RealtimeModule],
  controllers: [NexusSocialController],
  providers: [
    NexusEntitlementService,
    NexusSocialService,
    NexusSocialLifecycleService,
    NexusSocialPrivacyService
  ],
  exports: [
    NexusEntitlementService,
    NexusSocialService,
    NexusSocialLifecycleService,
    NexusSocialPrivacyService
  ]
})
export class NexusSocialModule {}
