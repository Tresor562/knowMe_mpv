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
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateSecretConversationDto,
  SendSecretMessageDto
} from './secret-chat.dto';
import { SecretChatService } from './secret-chat.service';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  })
)
@Controller('e2ee')
export class SecretChatController {
  constructor(private readonly secretChats: SecretChatService) {}

  @Get('secret-chat-policy')
  policy() {
    return this.secretChats.policy();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('secret-conversations')
  create(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Body() dto: CreateSecretConversationDto
  ) {
    return this.secretChats.createConversation(
      req.user.userId,
      req.user.sessionId,
      dto
    );
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('secret-conversations/:conversationId/messages')
  send(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Param('conversationId') conversationId: string,
    @Body() dto: SendSecretMessageDto
  ) {
    return this.secretChats.send(
      req.user.userId,
      req.user.sessionId,
      conversationId,
      dto
    );
  }

  @Get('secret-messages/inbox')
  inbox(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.secretChats.inbox(
      req.user.userId,
      req.user.sessionId,
      cursor,
      limit
    );
  }

  @Patch('secret-messages/inbox/:envelopeId/delivered')
  delivered(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Param('envelopeId') envelopeId: string
  ) {
    return this.secretChats.markDelivered(
      req.user.userId,
      req.user.sessionId,
      envelopeId
    );
  }

  @Patch('secret-messages/inbox/:envelopeId/read')
  read(
    @Req() req: { user: { userId: string; sessionId?: string } },
    @Param('envelopeId') envelopeId: string
  ) {
    return this.secretChats.markRead(
      req.user.userId,
      req.user.sessionId,
      envelopeId
    );
  }
}
