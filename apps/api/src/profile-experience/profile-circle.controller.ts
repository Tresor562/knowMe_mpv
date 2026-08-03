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
import { ProfileCircleNotificationsService } from './profile-circle-notifications.service';
import { ProfileCircleService } from './profile-circle.service';

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-circles')
export class ProfileCircleController {
  constructor(
    private readonly circles: ProfileCircleService,
    private readonly notifications: ProfileCircleNotificationsService
  ) {}

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
  async decline(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    const circle = await this.notifications.circleSummary(circleId);
    const result = await this.circles.declineInvitation(req.user.userId, circleId);
    const actor = await this.notifications.actorLabel(req.user.userId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-invitation-declined:${circleId}:${req.user.userId}`,
      type: 'CIRCLE_INVITATION_DECLINED',
      title: `Invitation refusée${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} a refusé l’invitation.`,
      recipients: await this.notifications.activeManagers(circleId),
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        relationEnded: result.relationEnded,
        link: '/profile-circles'
      }
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/leave')
  async leave(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    const circle = await this.notifications.circleSummary(circleId);
    const result = await this.circles.leave(req.user.userId, circleId);
    const actor = await this.notifications.actorLabel(req.user.userId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-member-left:${circleId}:${req.user.userId}:${result.membership.id}`,
      type: 'CIRCLE_MEMBER_LEFT',
      title: `Membre parti${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} a quitté la structure.`,
      recipients: await this.notifications.activeManagers(circleId),
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        circleStatus: result.circleStatus,
        link: '/profile-circles'
      }
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/lifecycle')
  async lifecycle(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: ProfileCircleLifecycleDto
  ) {
    const circle = await this.circles.lifecycle(req.user.userId, circleId, dto);
    const actor = await this.notifications.actorLabel(req.user.userId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-lifecycle:${circleId}:${dto.action}:${circle.updatedAt.toISOString()}`,
      type: 'CIRCLE_LIFECYCLE_CHANGED',
      title: `${circle.name} · ${circle.status}`,
      body: `${actor} a modifié l’état du profil collectif.`,
      recipients: await this.notifications.activeMembers(circleId),
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle.slug,
        status: circle.status,
        action: dto.action,
        link: `/circles/${encodeURIComponent(circle.slug)}`
      }
    });
    return circle;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/join-requests')
  async requestJoin(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleJoinRequestDto
  ) {
    const request = await this.circles.requestJoin(req.user.userId, circleId, dto);
    const [circle, actor, managers] = await Promise.all([
      this.notifications.circleSummary(circleId),
      this.notifications.actorLabel(req.user.userId),
      this.notifications.activeManagers(circleId)
    ]);
    await this.notifications.dispatch({
      idempotencyKey: `circle-join-requested:${request.id}:${request.updatedAt.toISOString()}`,
      type: 'CIRCLE_JOIN_REQUESTED',
      title: `Nouvelle demande${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} souhaite rejoindre la guilde.`,
      recipients: managers,
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        requestId: request.id,
        link: '/profile-circles'
      }
    });
    return request;
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
  async reviewJoinRequest(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewProfileCircleJoinRequestDto
  ) {
    const result = await this.circles.reviewJoinRequest(
      req.user.userId,
      circleId,
      requestId,
      dto
    );
    const circle = await this.notifications.circleSummary(circleId);
    const applicantId =
      'membership' in result ? result.membership.userId : result.userId;
    await this.notifications.dispatch({
      idempotencyKey: `circle-join-reviewed:${requestId}:${dto.action}`,
      type:
        dto.action === 'APPROVE'
          ? 'CIRCLE_JOIN_APPROVED'
          : 'CIRCLE_JOIN_DECLINED',
      title:
        dto.action === 'APPROVE'
          ? `Adhésion acceptée${circle ? ` · ${circle.name}` : ''}`
          : `Adhésion refusée${circle ? ` · ${circle.name}` : ''}`,
      body:
        dto.action === 'APPROVE'
          ? 'Ta demande d’adhésion a été acceptée.'
          : 'Ta demande d’adhésion a été refusée.',
      recipients: [applicantId],
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        requestId,
        decision: dto.action,
        link:
          dto.action === 'APPROVE' && circle
            ? `/circles/${encodeURIComponent(circle.slug)}`
            : '/profile-circles'
      }
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/members/:memberUserId/remove')
  async removeMember(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: RemoveProfileCircleMemberDto
  ) {
    const circle = await this.notifications.circleSummary(circleId);
    const result = await this.circles.removeMember(
      req.user.userId,
      circleId,
      memberUserId,
      dto
    );
    await this.notifications.dispatch({
      idempotencyKey: `circle-member-removed:${circleId}:${memberUserId}:${result.membership.updatedAt.toISOString()}`,
      type: 'CIRCLE_MEMBER_REMOVED',
      title: `Participation terminée${circle ? ` · ${circle.name}` : ''}`,
      body: 'Ta participation à ce profil collectif a été retirée.',
      recipients: [memberUserId],
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        circleStatus: result.circleStatus,
        link: '/profile-circles'
      }
    });
    return result;
  }
}
