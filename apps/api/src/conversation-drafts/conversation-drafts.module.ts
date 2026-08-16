import { Module } from '@nestjs/common';
import { ConversationDraftsController } from './conversation-drafts.controller';
import { ConversationDraftsService } from './conversation-drafts.service';

@Module({
  controllers: [ConversationDraftsController],
  providers: [ConversationDraftsService],
  exports: [ConversationDraftsService]
})
export class ConversationDraftsModule {}
