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
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
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

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.posts.getById(id);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.posts.comments(id, cursor);
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
