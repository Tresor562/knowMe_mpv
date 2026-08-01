import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post()
  create(@Req() req:{user:{userId:string}}, @Body() dto:CreateConversationDto){
    return this.messaging.createConversation(req.user.userId,dto);
  }

  @Get()
  list(@Req() req:{user:{userId:string}}){
    return this.messaging.list(req.user.userId);
  }

  @Post(':id/messages')
  send(@Req() req:{user:{userId:string}}, @Param('id') id:string, @Body() dto:SendMessageDto){
    return this.messaging.send(req.user.userId,id,dto.content);
  }
}
