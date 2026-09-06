import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoryAlbumsService } from './story-albums.service';

@UseGuards(JwtAuthGuard)
@Controller('story-albums')
export class StoryAlbumsController {
  constructor(private readonly albums: StoryAlbumsService) {}

  @Get('mine')
  mine(@Req() req: { user: { userId: string } }) {
    return this.albums.mine(req.user.userId);
  }

  @Get(':id')
  get(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.albums.get(req.user.userId, id);
  }

  @Post(':id/stories/:storyId')
  add(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('storyId') storyId: string,
    @Body() body: { position?: number }
  ) {
    return this.albums.add(req.user.userId, id, storyId, body.position);
  }

  @Delete(':id/stories/:storyId')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('storyId') storyId: string
  ) {
    return this.albums.remove(req.user.userId, id, storyId);
  }
}
