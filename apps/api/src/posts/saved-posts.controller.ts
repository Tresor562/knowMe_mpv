import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SavedPostsService } from './saved-posts.service';

/**
 * Register this controller *before* the general PostsController so /posts/saved
 * is never swallowed by the public GET /posts/:id route.
 * All endpoints require the authenticated actor from JwtAuthGuard.
 */
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class SavedPostsController {
  constructor(private readonly savedPosts: SavedPostsService) {}

  @Get('saved')
  saved(@Req() req: { user: { userId: string } }) {
    return this.savedPosts.list(req.user.userId);
  }

  @Get(':id/saved')
  status(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.savedPosts.status(req.user.userId, id);
  }

  @Post(':id/save')
  save(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.savedPosts.save(req.user.userId, id);
  }

  @Delete(':id/save')
  unsave(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.savedPosts.unsave(req.user.userId, id);
  }
}
