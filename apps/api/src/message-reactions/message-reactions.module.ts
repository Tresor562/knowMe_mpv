import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageReactionsController } from './message-reactions.controller';
import { MessageReactionsService } from './message-reactions.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MessageReactionsController],
  providers: [MessageReactionsService]
})
export class MessageReactionsModule {}
