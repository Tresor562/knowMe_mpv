import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, PublishChannelPostDto, UpdateChannelDto } from './channels.dto';

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly moderation: ModerationService
  ) {}

  @Get('mine')
  mine(@Req() req: {user: {userId: string}}) {
    return this.channels.mine(req.user.userId);
  }

  @Get('discover')
  discover(@Req() req: {user: {userId: string}}, @Query('q') query?: string) {
    return this.channels.discover(req.user.userId, query);
  }

  @Post()
  async create(@Req() req: {user: {userId: string}}, @Body() dto: CreateChannelDto) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId, action: 'POST_CREATE',
      content: `${dto.name} ${dto.description || ''}`
    });
    return this.channels.create(req.user.userId, dto);
  }

  @Get(':id')
  details(@Req() req: {user: {userId: string}}, @Param('id') id: string) {
    return this.channels.details(req.user.userId, id);
  }

  @Patch(':id')
  async update(@Req() req: {user: {userId: string}}, @Param('id') id: string, @Body() dto: UpdateChannelDto) {
    if (dto.name !== undefined || dto.description !== undefined) {
      await this.moderation.assertAllowed({
        actorId: req.user.userId,
        action: 'POST_CREATE',
        content: `${dto.name || ''} ${dto.description || ''}`,
        targetId: id
      });
    }
    return this.channels.update(req.user.userId, id, dto);
  }

  @Post(':id/follow')
  follow(@Req() req: {user: {userId: string}}, @Param('id') id: string) {
    return this.channels.follow(req.user.userId, id);
  }

  @Delete(':id/follow')
  unfollow(@Req() req: {user: {userId: string}}, @Param('id') id: string) {
    return this.channels.unfollow(req.user.userId, id);
  }

  @Get(':id/posts')
  posts(@Req() req: {user: {userId: string}}, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.channels.posts(req.user.userId, id, cursor);
  }

  @Post(':id/posts')
  async publish(@Req() req: {user: {userId: string}}, @Param('id') id: string,
    @Body() dto: PublishChannelPostDto) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId, action: 'POST_CREATE', content: dto.content, targetId: id
    });
    return this.channels.publish(req.user.userId, id, dto.content);
  }
}
