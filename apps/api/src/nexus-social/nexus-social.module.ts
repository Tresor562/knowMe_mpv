import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NexusSocialController } from './nexus-social.controller';
import { NexusSocialService } from './nexus-social.service';

@Module({
  imports: [RealtimeModule],
  controllers: [NexusSocialController],
  providers: [NexusSocialService],
  exports: [NexusSocialService]
})
export class NexusSocialModule {}
