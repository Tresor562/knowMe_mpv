import { Module } from '@nestjs/common';
import { ConversationPinsController } from './conversation-pins.controller';
import { ConversationPinsService } from './conversation-pins.service';

@Module({
  controllers: [ConversationPinsController],
  providers: [ConversationPinsService]
})
export class ConversationPinsModule {}
