import { Module } from '@nestjs/common';
import { SavedMessagesController } from './saved-messages.controller';
import { SavedMessagesService } from './saved-messages.service';

@Module({
  controllers: [SavedMessagesController],
  providers: [SavedMessagesService],
  exports: [SavedMessagesService]
})
export class SavedMessagesModule {}
