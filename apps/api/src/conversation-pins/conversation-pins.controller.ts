import {
  BadRequestException,
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
    @Body() body: { conversationIds?: unknown; expectedConversationIds?: unknown }
  ) {
    if (
      !Array.isArray(body?.conversationIds) ||
      body.conversationIds.some((value) => typeof value !== 'string')
    ) {
      throw new BadRequestException('CONVERSATION_PIN_ORDER_INVALID');
    }
    if (
      !Array.isArray(body?.expectedConversationIds) ||
      body.expectedConversationIds.some((value) => typeof value !== 'string')
    ) {
      throw new BadRequestException('CONVERSATION_PIN_EXPECTED_ORDER_REQUIRED');
    }
    return this.pins.reorder(
      req.user.userId,
      body.conversationIds as string[],
      body.expectedConversationIds as string[]
    );
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
