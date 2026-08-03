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
  CreateProfileCircleMomentDto,
  CreateProfileCircleOwnershipTransferDto,
  CreateProfileCircleStoryDto,
  CreateProfileFamilyRelationDto,
  ModerateProfileCircleContentDto,
  ProfileFamilyRelationActionDto,
  UpdateProfileCircleRoleDto
} from './dto/profile-circle-governance.dto';
import { ProfileCircleGovernanceService } from './profile-circle-governance.service';
import { ProfileCircleNotificationsService } from './profile-circle-notifications.service';

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-circle-governance')
export class ProfileCircleGovernanceController {
  constructor(
    private readonly governance: ProfileCircleGovernanceService,
    private readonly notifications: ProfileCircleNotificationsService
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('public/:slug')
  publicBundle(
    @Req() req: OptionalAuthRequest,
    @Param('slug') slug: string
  ) {
    return this.governance.publicBundle(slug.trim(), req.user?.userId ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/transfers')
  transfers(@Req() req: AuthRequest) {
    return this.governance.transfersForMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/family-relations/pending')
  pendingFamilyRelations(@Req() req: AuthRequest) {
    return this.governance.pendingFamilyRelations(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':circleId/members/:memberUserId/role')
  async updateRole(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateProfileCircleRoleDto
  ) {
    const membership = await this.governance.updateRole(
      req.user.userId,
      circleId,
      memberUserId,
      dto
    );
    const circle = await this.notifications.circleSummary(circleId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-role-changed:${membership.id}:${membership.updatedAt.toISOString()}`,
      type: 'CIRCLE_ROLE_CHANGED',
      title: `Nouveau rôle${circle ? ` · ${circle.name}` : ''}`,
      body: `Ton rôle collectif est maintenant ${membership.role}.`,
      recipients: [memberUserId],
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        role: membership.role,
        link: '/profile-circle-governance'
      }
    });
    return membership;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/transfers')
  async createTransfer(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleOwnershipTransferDto
  ) {
    const transfer = await this.governance.createOwnershipTransfer(
      req.user.userId,
      circleId,
      dto
    );
    const [circle, actor] = await Promise.all([
      this.notifications.circleSummary(circleId),
      this.notifications.actorLabel(req.user.userId)
    ]);
    await this.notifications.dispatch({
      idempotencyKey: `circle-transfer-created:${transfer.id}`,
      type: 'CIRCLE_TRANSFER_CREATED',
      title: `Transfert de propriété${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} te propose de devenir propriétaire.`,
      recipients: [transfer.toUserId],
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        transferId: transfer.id,
        expiresAt: transfer.expiresAt.toISOString(),
        link: '/profile-circle-governance'
      }
    });
    return transfer;
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfers/:transferId/accept')
  async acceptTransfer(
    @Req() req: AuthRequest,
    @Param('transferId') transferId: string
  ) {
    const transfer = await this.governance.acceptOwnershipTransfer(
      req.user.userId,
      transferId
    );
    const [circle, actor] = await Promise.all([
      this.notifications.circleSummary(transfer.circleId),
      this.notifications.actorLabel(req.user.userId)
    ]);
    await this.notifications.dispatch({
      idempotencyKey: `circle-transfer-accepted:${transfer.id}`,
      type: 'CIRCLE_TRANSFER_ACCEPTED',
      title: `Transfert accepté${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} est maintenant propriétaire de la structure.`,
      recipients: [transfer.fromUserId],
      actorUserId: req.user.userId,
      circleId: transfer.circleId,
      data: {
        circleId: transfer.circleId,
        circleSlug: circle?.slug ?? null,
        transferId: transfer.id,
        link: '/profile-circle-governance'
      }
    });
    return transfer;
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfers/:transferId/cancel')
  async cancelTransfer(
    @Req() req: AuthRequest,
    @Param('transferId') transferId: string
  ) {
    const transfer = await this.governance.cancelOwnershipTransfer(
      req.user.userId,
      transferId
    );
    const circle = await this.notifications.circleSummary(transfer.circleId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-transfer-cancelled:${transfer.id}:${transfer.cancelledAt?.toISOString() ?? 'cancelled'}`,
      type: 'CIRCLE_TRANSFER_CANCELLED',
      title: `Transfert annulé${circle ? ` · ${circle.name}` : ''}`,
      body: 'La proposition de transfert de propriété a été annulée.',
      recipients: [transfer.fromUserId, transfer.toUserId],
      actorUserId: req.user.userId,
      circleId: transfer.circleId,
      data: {
        circleId: transfer.circleId,
        circleSlug: circle?.slug ?? null,
        transferId: transfer.id,
        link: '/profile-circle-governance'
      }
    });
    return transfer;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/moments')
  createMoment(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleMomentDto
  ) {
    return this.governance.createMoment(req.user.userId, circleId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/stories')
  createStory(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleStoryDto
  ) {
    return this.governance.createStory(req.user.userId, circleId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':circleId/moderation')
  moderationQueue(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string
  ) {
    return this.governance.moderationQueue(req.user.userId, circleId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('moments/:momentId/moderate')
  async moderateMoment(
    @Req() req: AuthRequest,
    @Param('momentId') momentId: string,
    @Body() dto: ModerateProfileCircleContentDto
  ) {
    const moment = await this.governance.moderateMoment(
      req.user.userId,
      momentId,
      dto
    );
    const circle = await this.notifications.circleSummary(moment.circleId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-moment-moderated:${moment.id}:${moment.updatedAt.toISOString()}`,
      type: this.contentNotificationType(dto.action),
      title: `Moment ${this.contentDecisionLabel(dto.action)}${circle ? ` · ${circle.name}` : ''}`,
      body: `La modération a ${this.contentDecisionLabel(dto.action)} ton moment collectif.`,
      recipients: [moment.authorUserId],
      actorUserId: req.user.userId,
      circleId: moment.circleId,
      data: {
        circleId: moment.circleId,
        circleSlug: circle?.slug ?? null,
        momentId: moment.id,
        decision: dto.action,
        link: circle
          ? `/circles/${encodeURIComponent(circle.slug)}`
          : '/profile-circles'
      }
    });
    return moment;
  }

  @UseGuards(JwtAuthGuard)
  @Post('stories/:storyId/moderate')
  async moderateStory(
    @Req() req: AuthRequest,
    @Param('storyId') storyId: string,
    @Body() dto: ModerateProfileCircleContentDto
  ) {
    const story = await this.governance.moderateStory(
      req.user.userId,
      storyId,
      dto
    );
    const circle = await this.notifications.circleSummary(story.circleId);
    await this.notifications.dispatch({
      idempotencyKey: `circle-story-moderated:${story.id}:${story.updatedAt.toISOString()}`,
      type: this.contentNotificationType(dto.action),
      title: `Story ${this.contentDecisionLabel(dto.action)}${circle ? ` · ${circle.name}` : ''}`,
      body: `La modération a ${this.contentDecisionLabel(dto.action)} ta Story collective.`,
      recipients: [story.authorUserId],
      actorUserId: req.user.userId,
      circleId: story.circleId,
      data: {
        circleId: story.circleId,
        circleSlug: circle?.slug ?? null,
        storyId: story.id,
        decision: dto.action,
        link: circle
          ? `/circles/${encodeURIComponent(circle.slug)}`
          : '/profile-circles'
      }
    });
    return story;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/family-relations')
  async proposeFamilyRelation(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileFamilyRelationDto
  ) {
    const relation = await this.governance.proposeFamilyRelation(
      req.user.userId,
      circleId,
      dto
    );
    const [circle, actor] = await Promise.all([
      this.notifications.circleSummary(circleId),
      this.notifications.actorLabel(req.user.userId)
    ]);
    await this.notifications.dispatch({
      idempotencyKey: `family-relation-proposed:${relation.id}:${relation.updatedAt.toISOString()}`,
      type: 'FAMILY_RELATION_PROPOSED',
      title: `Lien familial proposé${circle ? ` · ${circle.name}` : ''}`,
      body: `${actor} te propose un lien familial déclaré.`,
      recipients: [dto.otherUserId],
      actorUserId: req.user.userId,
      circleId,
      data: {
        circleId,
        circleSlug: circle?.slug ?? null,
        relationId: relation.id,
        relationType: relation.type,
        link: '/profile-circle-governance'
      }
    });
    return relation;
  }

  @UseGuards(JwtAuthGuard)
  @Post('family-relations/:relationId/action')
  async familyRelationAction(
    @Req() req: AuthRequest,
    @Param('relationId') relationId: string,
    @Body() dto: ProfileFamilyRelationActionDto
  ) {
    const relation = await this.governance.familyRelationAction(
      req.user.userId,
      relationId,
      dto
    );
    const circle = await this.notifications.circleSummary(relation.circleId);
    const otherUserId =
      relation.firstUserId === req.user.userId
        ? relation.secondUserId
        : relation.firstUserId;
    await this.notifications.dispatch({
      idempotencyKey: `family-relation-action:${relation.id}:${dto.action}:${relation.updatedAt.toISOString()}`,
      type: this.familyNotificationType(dto.action),
      title: `Lien familial ${this.familyDecisionLabel(dto.action)}${circle ? ` · ${circle.name}` : ''}`,
      body: `La proposition familiale a été ${this.familyDecisionLabel(dto.action)}.`,
      recipients: [otherUserId],
      actorUserId: req.user.userId,
      circleId: relation.circleId,
      data: {
        circleId: relation.circleId,
        circleSlug: circle?.slug ?? null,
        relationId: relation.id,
        decision: dto.action,
        link: '/profile-circle-governance'
      }
    });
    return relation;
  }

  private contentNotificationType(action: 'APPROVE' | 'HIDE' | 'REMOVE') {
    if (action === 'APPROVE') return 'CIRCLE_CONTENT_APPROVED' as const;
    if (action === 'HIDE') return 'CIRCLE_CONTENT_HIDDEN' as const;
    return 'CIRCLE_CONTENT_REMOVED' as const;
  }

  private contentDecisionLabel(action: 'APPROVE' | 'HIDE' | 'REMOVE') {
    if (action === 'APPROVE') return 'approuvé';
    if (action === 'HIDE') return 'masqué';
    return 'retiré';
  }

  private familyNotificationType(action: 'ACCEPT' | 'DECLINE' | 'REMOVE') {
    if (action === 'ACCEPT') return 'FAMILY_RELATION_ACCEPTED' as const;
    if (action === 'DECLINE') return 'FAMILY_RELATION_DECLINED' as const;
    return 'FAMILY_RELATION_REMOVED' as const;
  }

  private familyDecisionLabel(action: 'ACCEPT' | 'DECLINE' | 'REMOVE') {
    if (action === 'ACCEPT') return 'acceptée';
    if (action === 'DECLINE') return 'refusée';
    return 'retirée';
  }
}
