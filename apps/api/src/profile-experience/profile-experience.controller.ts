import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  CreateProfileCircleDto,
  CreateProfileMemoryDto,
  CreateProfileWallPostDto,
  RecordProfileCaptureEventDto,
  UpdateProfileExperienceDto,
  UpdateProfileGuardDto,
  UpdateProfileVisibilityDto
} from './dto/profile-experience.dto';
import { ProfileCircleNotificationsService } from './profile-circle-notifications.service';
import { ProfileExperienceService } from './profile-experience.service';
import { ProfilePublicService } from './profile-public.service';

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-experience')
export class ProfileExperienceController {
  constructor(
    private readonly profiles: ProfileExperienceService,
    private readonly publicProfiles: ProfilePublicService,
    private readonly circleNotifications: ProfileCircleNotificationsService
  ) {}

  @Get('policy')
  policy() {
    return this.profiles.policy();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest) {
    return this.profiles.ownerDashboard(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: AuthRequest, @Body() dto: UpdateProfileExperienceDto) {
    return this.profiles.updateProfile(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/visibility')
  updateVisibility(
    @Req() req: AuthRequest,
    @Body() dto: UpdateProfileVisibilityDto
  ) {
    return this.profiles.updateVisibility(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/guard')
  updateGuard(@Req() req: AuthRequest, @Body() dto: UpdateProfileGuardDto) {
    return this.profiles.updateGuard(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('circles')
  async createCircle(
    @Req() req: AuthRequest,
    @Body() dto: CreateProfileCircleDto
  ) {
    const circle = await this.profiles.createCircle(req.user.userId, dto);
    const actor = await this.circleNotifications.actorLabel(req.user.userId);
    await this.circleNotifications.dispatch({
      idempotencyKey: `circle-invitation:${circle.id}`,
      type: 'CIRCLE_INVITATION',
      title: `Invitation · ${circle.name}`,
      body: `${actor} t’invite à rejoindre ce profil collectif.`,
      recipients: circle.members
        .filter((member) => member.status === 'INVITED')
        .map((member) => member.userId),
      actorUserId: req.user.userId,
      circleId: circle.id,
      data: {
        circleId: circle.id,
        circleSlug: circle.slug,
        circleType: circle.type,
        link: '/profile-circles'
      }
    });
    return circle;
  }

  @UseGuards(JwtAuthGuard)
  @Post('circles/:circleId/accept')
  async acceptCircle(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string
  ) {
    const circle = await this.profiles.acceptCircle(req.user.userId, circleId);
    if (circle) {
      const actor = await this.circleNotifications.actorLabel(req.user.userId);
      await this.circleNotifications.dispatch({
        idempotencyKey: `circle-invitation-accepted:${circleId}:${req.user.userId}`,
        type: 'CIRCLE_INVITATION_ACCEPTED',
        title: `Invitation acceptée · ${circle.name}`,
        body: `${actor} a accepté l’invitation.`,
        recipients: [circle.ownerUserId],
        actorUserId: req.user.userId,
        circleId,
        data: {
          circleId,
          circleSlug: circle.slug,
          link: `/circles/${encodeURIComponent(circle.slug)}`
        }
      });
    }
    return circle;
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('public/:username')
  publicProfile(
    @Req() req: OptionalAuthRequest,
    @Param('username') username: string
  ) {
    return this.publicProfiles.snapshot(
      username.trim(),
      req.user?.userId ?? null
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('public/:username/wall')
  createWallPost(
    @Req() req: AuthRequest,
    @Param('username') username: string,
    @Body() dto: CreateProfileWallPostDto
  ) {
    return this.profiles.createWallPost(req.user.userId, username.trim(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/memories')
  memories(@Req() req: AuthRequest) {
    return this.profiles.memories(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/memories')
  addMemory(@Req() req: AuthRequest, @Body() dto: CreateProfileMemoryDto) {
    return this.profiles.addMemory(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('capture-events')
  captureEvent(
    @Req() req: AuthRequest,
    @Body() dto: RecordProfileCaptureEventDto
  ) {
    return this.profiles.recordCaptureEvent(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('compatibility/:username')
  compatibility(@Req() req: AuthRequest, @Param('username') username: string) {
    return this.profiles.compatibility(req.user.userId, username.trim());
  }
}
