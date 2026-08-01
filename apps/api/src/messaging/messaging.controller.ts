import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

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

  @Get(':id/messages')
  history(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.messaging.history(req.user.userId, id, cursor, limit);
  }

  @Post(':id/messages')
  send(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMessageDto
  ) {
    return this.messaging.send(req.user.userId, id, dto.content);
  }
}
