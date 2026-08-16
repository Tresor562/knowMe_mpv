import { Module } from '@nestjs/common';
import { ConversationFoldersController } from './conversation-folders.controller';
import { ConversationFoldersService } from './conversation-folders.service';

@Module({
  controllers: [ConversationFoldersController],
  providers: [ConversationFoldersService]
})
export class ConversationFoldersModule {}
