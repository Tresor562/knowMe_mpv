import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendMediaMessageDto } from './dto/send-media-message.dto';
import { MessageEditingService } from './message-editing.service';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly messageEditing: MessageEditingService,
    private readonly moderation: ModerationService
  ) {}

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateConversationDto
  ) {
    return this.messaging.createConversation(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.messaging.list(req.user.userId);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: { userId: string } }) {
    return this.messaging.unreadCount(req.user.userId);
  }

  @Get(':id/messages')
  history(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.messaging.history(req.user.userId, id, cursor, limit);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.messaging.markRead(req.user.userId, id);
  }

  @Post(':id/messages')
  async send(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMessageDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'MESSAGE_SEND',
      content: dto.content,
      targetId: id
    });
    return this.messaging.send(req.user.userId, id, dto.content);
  }

  @Post(':id/media-messages')
  async sendMedia(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMediaMessageDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'MESSAGE_SEND',
      // Bind the duplicate-content fingerprint to the actual media asset.
      // Different GIFs must not be mistaken for repeated identical text,
      // while repeatedly posting the same media remains rate-limited.
      content: `${dto.kind}:${dto.assetId}`,
      targetId: id
    });
    return this.messaging.sendMediaMessage(req.user.userId, id, dto.assetId, dto.kind);
  }

  @Patch(':id/messages/:messageId')
  async edit(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'MESSAGE_SEND',
      content: dto.content,
      targetId: id
    });
    return this.messageEditing.edit(req.user.userId, id, messageId, dto);
  }
}
