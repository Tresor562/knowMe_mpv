import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveMessageDto } from './dto/save-message.dto';
import { SavedMessagesService } from './saved-messages.service';

@UseGuards(JwtAuthGuard)
@Controller('saved-messages')
export class SavedMessagesController {
  constructor(private readonly savedMessages: SavedMessagesService) {}

  @Get()
  list(
    @Req() req: { user: { userId: string } },
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.savedMessages.list(req.user.userId, limit);
  }

  @Post()
  save(
    @Req() req: { user: { userId: string } },
    @Body() dto: SaveMessageDto
  ) {
    return this.savedMessages.save(req.user.userId, dto.messageId);
  }

  @Delete(':messageId')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('messageId') messageId: string
  ) {
    return this.savedMessages.remove(req.user.userId, messageId);
  }
}
