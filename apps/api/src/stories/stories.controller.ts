import {
  BadRequestException,
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
import { StoryAssetPolicyService } from './story-asset-policy.service';
import { StoryInteractionNotifier } from './story-interaction-notifier.service';
import { StoryLifecycleService } from './story-lifecycle.service';
import { StoriesService } from './stories.service';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly assets: StoryAssetPolicyService,
    private readonly lifecycle: StoryLifecycleService,
    private readonly notifier: StoryInteractionNotifier,
    private readonly moderation: ModerationService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateStoryDto
  ) {
    await Promise.all([
      this.moderation.assertAllowed({
        actorId: req.user.userId,
        action: 'POST_CREATE',
        content: dto.caption
      }),
      this.assets.assertPublishable(req.user.userId, dto.assetId)
    ]);
    const story = await this.stories.create(req.user.userId, dto);
    if (dto.mentionUserIds?.length) {
      await this.notifier.mentions(story.id, req.user.userId,
        dto.mentionUserIds.filter(id => !(dto.excludeUserIds ?? []).includes(id)));
    }
    return story;
  }

  @UseGuards(JwtAuthGuard)
  @Post('batch')
  async createBatch(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateStoryBatchDto
  ) {
    for (const story of dto.stories) {
      await Promise.all([
        this.moderation.assertAllowed({
          actorId: req.user.userId,
          action: 'POST_CREATE',
          content: story.caption
        }),
        this.assets.assertPublishable(req.user.userId, story.assetId)
      ]);
    }
    const result = await this.stories.createBatch(req.user.userId, dto.stories);
    for (let index = 0; index < result.stories.length; index += 1) {
      const mentions = dto.stories[index]?.mentionUserIds;
      if (mentions?.length) {
        await this.notifier.mentions(result.stories[index].id, req.user.userId,
          mentions.filter(id => !(dto.stories[index]?.excludeUserIds ?? []).includes(id)));
      }
    }
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  feed(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string
  ) {
    return this.stories.feed(req.user.userId, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Get('audience/candidates')
  audienceCandidates(
    @Req() req: { user: { userId: string } },
    @Query('q') q = ''
  ) {
    return this.stories.audienceCandidates(req.user.userId, q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rail')
  rail(
    @Req() req: { user: { userId: string } },
    @Query('offset') offset?: string
  ) {
    if (offset !== undefined && (!/^(0|[1-9]\d{0,5})$/.test(offset) || Number(offset) > 100000)) {
      throw new BadRequestException({ code: 'STORY_RAIL_OFFSET_INVALID', message: 'Invalid Story rail page.' });
    }
    return this.stories.rail(req.user.userId, offset ? Number(offset) : 0);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:username/visible')
  visibleByAuthor(
    @Req() req: { user: { userId: string } },
    @Param('username') username: string,
    @Query('cursor') cursor?: string
  ){
    if(cursor!==undefined&&!/^[a-zA-Z0-9_-]{1,128}$/.test(cursor)){
      throw new BadRequestException({
        code:'STORY_SEQUENCE_CURSOR_INVALID',message:'Invalid Story cursor.'
      });
    }
    return this.stories.visibleByAuthor(req.user.userId,username,cursor);
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
  async view(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StoryViewDto
  ) {
    const result = await this.stories.view(req.user.userId, id, dto);
    if (dto.screenshot) {
      await this.notifier.screenshot(id, req.user.userId);
    }
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reactions')
  async react(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: StoryReactionDto
  ) {
    const result = await this.stories.react(req.user.userId, id, dto);
    await this.notifier.reaction(id, req.user.userId, dto.reaction);
    return result;
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
    const result = await this.stories.reply(req.user.userId, id, dto);
    await this.notifier.reply(id, req.user.userId, result.id);
    return result;
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
    @Param('id') id: string,
    @Query('cursor') cursor?: string
  ) {
    // Cursor accepts only repository-generated opaque IDs, never SQL fragments
    // or user-controllable sorting expressions.
    if (cursor !== undefined && !/^[a-zA-Z0-9_-]{1,80}$/.test(cursor)) {
      throw new BadRequestException({
        code: 'STORY_VIEWER_CURSOR_INVALID',
        message: 'Invalid Story viewer page cursor.'
      });
    }
    return this.stories.viewers(req.user.userId, id, cursor);
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
  @Post(':id/live/end')
  endLive(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.lifecycle.endLive(req.user.userId, id);
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
