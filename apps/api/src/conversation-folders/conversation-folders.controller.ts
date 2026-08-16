import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationFoldersService } from './conversation-folders.service';
import { CreateConversationFolderDto } from './dto/create-conversation-folder.dto';
import { UpdateConversationFolderDto } from './dto/update-conversation-folder.dto';

@UseGuards(JwtAuthGuard)
@Controller('conversation-folders')
export class ConversationFoldersController {
  constructor(private readonly folders: ConversationFoldersService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.folders.list(req.user.userId);
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateConversationFolderDto
  ) {
    return this.folders.create(req.user.userId, dto);
  }

  @Patch(':folderId')
  update(
    @Req() req: { user: { userId: string } },
    @Param('folderId') folderId: string,
    @Body() dto: UpdateConversationFolderDto
  ) {
    return this.folders.update(req.user.userId, folderId, dto);
  }

  @Delete(':folderId')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('folderId') folderId: string
  ) {
    return this.folders.remove(req.user.userId, folderId);
  }

  @Put(':folderId/conversations/:conversationId')
  assign(
    @Req() req: { user: { userId: string } },
    @Param('folderId') folderId: string,
    @Param('conversationId') conversationId: string
  ) {
    return this.folders.assign(req.user.userId, folderId, conversationId);
  }

  @Delete('assignments/:conversationId')
  unassign(
    @Req() req: { user: { userId: string } },
    @Param('conversationId') conversationId: string
  ) {
    return this.folders.unassign(req.user.userId, conversationId);
  }
}
