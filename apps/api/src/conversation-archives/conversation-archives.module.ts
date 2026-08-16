import { Module } from '@nestjs/common';
import { ConversationArchivesController } from './conversation-archives.controller';
import { ConversationArchivesService } from './conversation-archives.service';

@Module({
  controllers: [ConversationArchivesController],
  providers: [ConversationArchivesService]
})
export class ConversationArchivesModule {}
