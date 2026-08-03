import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatorsService } from './creators.service';
import { PinCreatorPostDto } from './dto/pin-creator-post.dto';
import { UpsertCreatorProfileDto } from './dto/upsert-creator-profile.dto';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  mine(@Req() req: { user: { userId: string } }) {
    return this.creators.mine(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  upsert(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpsertCreatorProfileDto
  ) {
    return this.creators.upsert(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/dashboard')
  dashboard(@Req() req: { user: { userId: string } }) {
    return this.creators.dashboard(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/pins/:postId')
  pin(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string,
    @Body() dto: PinCreatorPostDto
  ) {
    return this.creators.pinPost(req.user.userId, postId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/pins/:postId')
  unpin(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string
  ) {
    return this.creators.unpinPost(req.user.userId, postId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':slug/follow')
  follow(
    @Req() req: { user: { userId: string } },
    @Param('slug') slug: string
  ) {
    return this.creators.follow(req.user.userId, slug);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':slug/follow')
  unfollow(
    @Req() req: { user: { userId: string } },
    @Param('slug') slug: string
  ) {
    return this.creators.unfollow(req.user.userId, slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/view')
  view(
    @Req() req: { user: { userId: string } },
    @Param('slug') slug: string
  ) {
    return this.creators.recordProfileView(req.user.userId, slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/view')
  viewPost(
    @Req() req: { user: { userId: string } },
    @Param('postId') postId: string
  ) {
    return this.creators.recordPostView(req.user.userId, postId);
  }

  @Get(':slug')
  publicProfile(@Param('slug') slug: string) {
    return this.creators.publicProfile(slug);
  }
}
