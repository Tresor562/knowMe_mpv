import { Module } from '@nestjs/common';
import { GroupManagementController } from './group-management.controller';
import { GroupAvatarController } from './group-avatar.controller';
import { GroupAvatarService } from './group-avatar.service';
import { MediaModule } from '../media/media.module';
import { GroupManagementService } from './group-management.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageEditingService } from './message-editing.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { StickerController } from './stickers/sticker.controller';
import { StickerTokenService } from './stickers/sticker-token.service';

@Module({
  imports: [RealtimeModule, MediaModule],
  controllers: [MessagingController, GroupManagementController, GroupAvatarController, StickerController],
  providers: [MessagingService, GroupManagementService, GroupAvatarService, MessageEditingService, StickerTokenService],
  exports: [MessagingService, StickerTokenService]
})
export class MessagingModule {}
