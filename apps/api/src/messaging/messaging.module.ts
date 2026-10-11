import { Module } from '@nestjs/common';
import { GroupManagementController } from './group-management.controller';
import { GroupManagementService } from './group-management.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageEditingService } from './message-editing.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { StickerController } from './stickers/sticker.controller';
import { StickerTokenService } from './stickers/sticker-token.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MessagingController, GroupManagementController, StickerController],
  providers: [MessagingService, GroupManagementService, MessageEditingService, StickerTokenService],
  exports: [MessagingService, StickerTokenService]
})
export class MessagingModule {}
