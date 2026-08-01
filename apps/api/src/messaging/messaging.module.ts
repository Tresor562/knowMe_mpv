import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MessagingController],
  providers: [MessagingService]
})
export class MessagingModule {}
