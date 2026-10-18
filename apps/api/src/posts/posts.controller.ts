import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { EditCommentDto } from './dto/edit-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { SetCommentReactionDto } from './dto/set-comment-reaction.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly moderation: ModerationService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreatePostDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'POST_CREATE',
      content: dto.content
    });
    return this.posts.create(req.user.userId, dto);
  }

  @Get('feed')
  feed(@Query('cursor') cursor?: string) {
    return this.posts.feed(cursor);
  }

  @Get('videos')
  videos(@Query('cursor') cursor?: string) {
    return this.posts.videos(cursor);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.posts.getById(id);
  }

  @Get(':id/comments')
  comments(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('roots') roots?: string
  ) {
    return this.posts.comments(id, cursor, roots === 'true');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':postId/comments/reaction-summaries')
  reactionSummaries(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Query('ids') ids: string
  ) {
    return this.posts.commentReactionSummaries(
      req.user.userId, postId,
      typeof ids === 'string' ? [...new Set(ids.split(',').filter(Boolean))] : []
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put(':postId/comments/:commentId/reaction')
  setReaction(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: SetCommentReactionDto
  ) {
    return this.posts.setCommentReaction(req.user.userId, postId, commentId, dto.emoji);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':postId/comments/:commentId/reaction')
  removeReaction(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string
  ) {
    return this.posts.removeCommentReaction(req.user.userId, postId, commentId);
  }

  @Get(':postId/comments/:commentId/replies')
  commentReplies(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Query('cursor') cursor?: string
  ) {
    return this.posts.commentReplies(postId, commentId, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.posts.toggleLike(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  async comment(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: CreateCommentDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'COMMENT_CREATE',
      content: dto.content,
      targetId: id
    });
    return this.posts.comment(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':postId/comments/:commentId')
  async editComment(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: EditCommentDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'COMMENT_CREATE',
      content: dto.content,
      targetId: postId
    });
    return this.posts.editComment(req.user.userId, postId, commentId, dto.content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':postId/comments/:commentId')
  removeComment(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Param('commentId') commentId: string
  ) {
    return this.posts.removeComment(req.user.userId, postId, commentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.posts.remove(req.user.userId, id);
  }
}
