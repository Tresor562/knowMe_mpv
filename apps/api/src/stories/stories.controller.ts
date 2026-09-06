import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import {
  CreateStoryAlbumDto,
  CreateStoryBatchDto,
  CreateStoryDto,
  StoryReactionDto,
  StoryReplyDto,
  StoryViewDto
} from './dto/stories.dto';
import { StoriesService } from './stories.service';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly moderation: ModerationService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateStoryDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'STORY_CREATE',
      content: dto.caption
    });
    return this.stories.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('batch')
  async createBatch(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateStoryBatchDto
  ) {
    for (const story of dto.stories) {
      await this.moderation.assertAllowed({
        actorId: req.user.userId,
        action: 'STORY_CREATE',
        content: story.caption
      });
    }
    return this.stories.createBatch(req.user.userId, dto.stories);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  feed(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string
  ) {
    return this.stories.feed(req.user.userId, cursor);
  }

  @Get('users/:username')
  profile(@Param('username') username: string) {
    return this.stories.forPublicProfile(username);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/archive')
  archive(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string
  ) {
    return this.stories.archiveForMe(req.user.userId, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Post('albums')
  createAlbum(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateStoryAlbumDto
  ) {
    return this.stories.createAlbum(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  get(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.get(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/view')
  view(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StoryViewDto
  ) {
    return this.stories.view(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reactions')
  react(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StoryReactionDto
  ) {
    return this.stories.react(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/reactions')
  removeReaction(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.removeReaction(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/replies')
  async reply(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StoryReplyDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'COMMENT_CREATE',
      content: dto.content,
      targetId: id
    });
    return this.stories.reply(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/archive')
  archiveOne(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.archive(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pin')
  pin(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.pin(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/pin')
  unpin(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.unpin(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/viewers')
  viewers(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.viewers(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/repost')
  repost(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('durationHours') durationHours?: string
  ) {
    return this.stories.repost(
      req.user.userId,
      id,
      durationHours ? Number(durationHours) : undefined
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.stories.remove(req.user.userId, id);
  }
}
