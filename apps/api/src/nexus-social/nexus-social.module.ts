import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NexusSocialController } from './nexus-social.controller';
import { NexusSocialLifecycleService } from './nexus-social-lifecycle.service';
import { NexusSocialService } from './nexus-social.service';

@Module({
  imports: [RealtimeModule],
  controllers: [NexusSocialController],
  providers: [NexusSocialService, NexusSocialLifecycleService],
  exports: [NexusSocialService, NexusSocialLifecycleService]
})
export class NexusSocialModule {}
