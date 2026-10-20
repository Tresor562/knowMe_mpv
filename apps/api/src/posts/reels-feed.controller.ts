import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReelsFeedService } from './reels-feed.service';

/** Dedicated routes avoid changing shared PostsController during social work. */
@UseGuards(JwtAuthGuard)
@Controller('reels')
export class ReelsFeedController {
  constructor(private readonly reels: ReelsFeedService) {}

  @Get('following')
  following(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string
  ) {
    return this.reels.following(req.user.userId, cursor);
  }

  @Get('likes')
  likeStates(
    @Req() req: { user: { userId: string } },
    @Query('ids') ids?: string
  ) {
    return this.reels.likeStates(req.user.userId, ids ?? '');
  }

  @Post(':id/like')
  toggleLike(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.reels.toggleLike(req.user.userId, id);
  }
}
