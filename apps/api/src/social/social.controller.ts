import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SocialService } from './social.service';

@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('search')
  search(
    @Req() req: { user: { userId: string } },
    @Query('q') query = ''
  ) {
    return this.social.searchUsers(req.user.userId, query);
  }

  @Post('friend-requests')
  sendRequest(
    @Req() req: { user: { userId: string } },
    @Body() dto: SendFriendRequestDto
  ) {
    return this.social.sendRequest(
      req.user.userId,
      dto.addresseeId
    );
  }

  @Get('friend-requests/incoming')
  incoming(@Req() req: { user: { userId: string } }) {
    return this.social.incoming(req.user.userId);
  }

  @Patch('friend-requests/:id/accept')
  accept(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.social.respond(req.user.userId, id, true);
  }

  @Patch('friend-requests/:id/decline')
  decline(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.social.respond(req.user.userId, id, false);
  }

  @Get('friends')
  friends(@Req() req: { user: { userId: string } }) {
    return this.social.listFriends(req.user.userId);
  }

  @Delete('friends/:id')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.social.removeFriend(req.user.userId, id);
  }

  @Post('blocks/:userId')
  block(
    @Req() req: { user: { userId: string } },
    @Param('userId') targetUserId: string
  ) {
    return this.social.block(req.user.userId, targetUserId);
  }
}
