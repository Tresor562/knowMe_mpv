import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  CreateProfileCircleJoinRequestDto,
  ProfileCircleLifecycleDto,
  RemoveProfileCircleMemberDto,
  ReviewProfileCircleJoinRequestDto,
  UpdateProfileCircleDto
} from './dto/profile-circle.dto';
import { ProfileCircleService } from './profile-circle.service';

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-circles')
export class ProfileCircleController {
  constructor(private readonly circles: ProfileCircleService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  mine(@Req() req: AuthRequest) {
    return this.circles.mine(req.user.userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('public/:slug')
  publicCircle(
    @Req() req: OptionalAuthRequest,
    @Param('slug') slug: string
  ) {
    return this.circles.publicSnapshot(slug.trim(), req.user?.userId ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':circleId')
  update(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: UpdateProfileCircleDto
  ) {
    return this.circles.update(req.user.userId, circleId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/decline')
  decline(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    return this.circles.declineInvitation(req.user.userId, circleId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/leave')
  leave(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    return this.circles.leave(req.user.userId, circleId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/lifecycle')
  lifecycle(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: ProfileCircleLifecycleDto
  ) {
    return this.circles.lifecycle(req.user.userId, circleId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/join-requests')
  requestJoin(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleJoinRequestDto
  ) {
    return this.circles.requestJoin(req.user.userId, circleId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':circleId/join-requests')
  joinRequests(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string
  ) {
    return this.circles.joinRequests(req.user.userId, circleId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/join-requests/:requestId/review')
  reviewJoinRequest(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewProfileCircleJoinRequestDto
  ) {
    return this.circles.reviewJoinRequest(
      req.user.userId,
      circleId,
      requestId,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/members/:memberUserId/remove')
  removeMember(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: RemoveProfileCircleMemberDto
  ) {
    return this.circles.removeMember(
      req.user.userId,
      circleId,
      memberUserId,
      dto
    );
  }
}
