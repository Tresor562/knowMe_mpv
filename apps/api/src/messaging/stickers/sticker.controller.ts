import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModerationService } from '../../moderation/moderation.service';
import { MessagingService } from '../messaging.service';
import { stickerCatalog } from './sticker-catalog';

class SendStickerDto {
  @IsString()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/)
  packKey!: string;

  @IsString()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/)
  stickerKey!: string;
}

type AuthRequest = { user: { userId: string } };

@UseGuards(JwtAuthGuard)
@Controller()
export class StickerController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly moderation: ModerationService
  ) {}

  @Get('stickers/catalog')
  catalog() {
    return {
      schemaVersion: 1,
      packs: stickerCatalog(),
      visualOnly: true,
      externalAssetAllowed: false,
      arbitraryHtmlAllowed: false,
      clientAssetAccepted: false
    };
  }

  @Post('conversations/:conversationId/stickers')
  async send(
    @Req() request: AuthRequest,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendStickerDto
  ) {
    await this.moderation.assertAllowed({
      actorId: request.user.userId,
      action: 'MESSAGE_SEND',
      content: `STICKER:${dto.packKey}:${dto.stickerKey}`,
      targetId: conversationId
    });
    return this.messaging.sendSticker({
      userId: request.user.userId,
      conversationId,
      packKey: dto.packKey,
      stickerKey: dto.stickerKey
    });
  }
}
