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
import { ConversationDraftsService } from './conversation-drafts.service';
import { SaveConversationDraftDto } from './dto/save-conversation-draft.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversation-drafts')
export class ConversationDraftsController {
  constructor(private readonly drafts: ConversationDraftsService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.drafts.list(req.user.userId);
  }

  @Put(':conversationId')
  save(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string,
    @Body() dto: SaveConversationDraftDto
  ) {
    return this.drafts.save(req.user.userId, conversationId, dto);
  }

  @Delete(':conversationId')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.drafts.remove(req.user.userId, conversationId);
  }
}
