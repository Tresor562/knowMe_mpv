import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationArchivesService } from './conversation-archives.service';

@UseGuards(JwtAuthGuard)
@Controller('conversation-archives')
export class ConversationArchivesController {
  constructor(private readonly archives: ConversationArchivesService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.archives.list(req.user.userId);
  }

  @Put(':conversationId')
  archive(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.archives.archive(req.user.userId, conversationId);
  }

  @Delete(':conversationId')
  restore(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.archives.restore(req.user.userId, conversationId);
  }
}
