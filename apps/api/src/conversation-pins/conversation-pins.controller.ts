import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationPinsService } from './conversation-pins.service';

@UseGuards(JwtAuthGuard)
@Controller('conversation-pins')
export class ConversationPinsController {
  constructor(private readonly pins: ConversationPinsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.pins.list(req.user.userId);
  }

  @Put('order')
  reorder(
    @Req() req: { user: { userId: string } },
    @Body() body: { conversationIds?: unknown }
  ) {
    const conversationIds = Array.isArray(body?.conversationIds)
      ? body.conversationIds.filter((value): value is string => typeof value === 'string')
      : [];
    if (!Array.isArray(body?.conversationIds) || conversationIds.length !== body.conversationIds.length) {
      return this.pins.reorder(req.user.userId, ['__INVALID__', '__INVALID__']);
    }
    return this.pins.reorder(req.user.userId, conversationIds);
  }

  @Put(':conversationId')
  pin(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.pins.pin(req.user.userId, conversationId);
  }

  @Delete(':conversationId')
  unpin(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.pins.unpin(req.user.userId, conversationId);
  }
}
