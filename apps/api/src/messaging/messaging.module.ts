import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConversationTranslationService } from './conversation-translation.service';
import { MediaMessageTokenService } from './media-message-token.service';
import { MessageEditingService } from './message-editing.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { StickerController } from './stickers/sticker.controller';
import { StickerTokenService } from './stickers/sticker-token.service';
import { VoiceTransformService } from './voice-transform.service';

@Module({
  imports: [RealtimeModule, MediaModule],
  controllers: [MessagingController, StickerController],
  providers: [
    MessagingService,
    MessageEditingService,
    StickerTokenService,
    MediaMessageTokenService,
    ConversationTranslationService,
    VoiceTransformService
  ],
  exports: [MessagingService, StickerTokenService, MediaMessageTokenService]
})
export class MessagingModule {}
