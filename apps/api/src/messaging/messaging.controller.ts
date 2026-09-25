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
import { SendMediaMessageDto } from './dto/send-media-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { TranslateConversationDto } from './dto/translate-conversation.dto';
import { ConversationTranslationService } from './conversation-translation.service';
import { MessageEditingService } from './message-editing.service';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly messageEditing: MessageEditingService,
    private readonly moderation: ModerationService,
    private readonly translation: ConversationTranslationService
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
  sendMedia(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMediaMessageDto
  ) {
    return this.messaging.sendMediaMessage(req.user.userId, id, dto);
  }

  @Get(':id/translation-offer')
  translationOffer(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('targetLanguage') targetLanguage = 'fr'
  ) {
    return this.translation.offer(req.user.userId, id, targetLanguage);
  }

  @Post(':id/translate')
  translate(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: TranslateConversationDto
  ) {
    return this.translation.translate(req.user.userId, id, dto);
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
