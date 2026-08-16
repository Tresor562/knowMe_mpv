import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessageEditingService } from './message-editing.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { StickerController } from './stickers/sticker.controller';
import { StickerTokenService } from './stickers/sticker-token.service';

@Module({
  imports: [RealtimeModule],
  controllers: [MessagingController, StickerController],
  providers: [MessagingService, MessageEditingService, StickerTokenService],
  exports: [MessagingService, StickerTokenService]
})
export class MessagingModule {}
