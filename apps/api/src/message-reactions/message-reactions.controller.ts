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
import { SetMessageReactionDto } from './dto/set-message-reaction.dto';
import { MessageReactionsService } from './message-reactions.service';

@UseGuards(JwtAuthGuard)
@Controller('message-reactions')
export class MessageReactionsController {
  constructor(private readonly reactions: MessageReactionsService) {}

  @Get(':messageId')
  list(
    @Req() req: { user: { userId: string } },
    @Param('messageId') messageId: string
  ) {
    return this.reactions.list(req.user.userId, messageId);
  }

  @Put(':messageId')
  set(
    @Req() req: { user: { userId: string } },
    @Param('messageId') messageId: string,
    @Body() dto: SetMessageReactionDto
  ) {
    return this.reactions.set(req.user.userId, messageId, dto.emoji);
  }

  @Delete(':messageId')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('messageId') messageId: string
  ) {
    return this.reactions.remove(req.user.userId, messageId);
  }
}
