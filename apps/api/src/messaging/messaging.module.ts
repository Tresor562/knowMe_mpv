import { Module } from '@nestjs/common';
import { GroupManagementController } from './group-management.controller';
import { GroupManagementService } from './group-management.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageEditingService } from './message-editing.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { StoryReplyDirectService } from './story-reply-direct.service';
import { StickerController } from './stickers/sticker.controller';
import { StickerTokenService } from './stickers/sticker-token.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MessagingController, GroupManagementController, StickerController],
  providers: [MessagingService, StoryReplyDirectService, GroupManagementService, MessageEditingService, StickerTokenService],
  exports: [MessagingService, StoryReplyDirectService, StickerTokenService]
})
export class MessagingModule {}
