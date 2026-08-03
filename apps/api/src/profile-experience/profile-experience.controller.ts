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
import { ProfileExperienceService } from './profile-experience.service';
import { ProfilePublicService } from './profile-public.service';

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-experience')
export class ProfileExperienceController {
  constructor(
    private readonly profiles: ProfileExperienceService,
    private readonly publicProfiles: ProfilePublicService
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
  createCircle(@Req() req: AuthRequest, @Body() dto: CreateProfileCircleDto) {
    return this.profiles.createCircle(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('circles/:circleId/accept')
  acceptCircle(@Req() req: AuthRequest, @Param('circleId') circleId: string) {
    return this.profiles.acceptCircle(req.user.userId, circleId);
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
