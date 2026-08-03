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

type AuthRequest = { user: { userId: string } };
type OptionalAuthRequest = { user: { userId: string } | null };

@Controller('profile-circle-governance')
export class ProfileCircleGovernanceController {
  constructor(private readonly governance: ProfileCircleGovernanceService) {}

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
  updateRole(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateProfileCircleRoleDto
  ) {
    return this.governance.updateRole(
      req.user.userId,
      circleId,
      memberUserId,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/transfers')
  createTransfer(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileCircleOwnershipTransferDto
  ) {
    return this.governance.createOwnershipTransfer(
      req.user.userId,
      circleId,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfers/:transferId/accept')
  acceptTransfer(
    @Req() req: AuthRequest,
    @Param('transferId') transferId: string
  ) {
    return this.governance.acceptOwnershipTransfer(
      req.user.userId,
      transferId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfers/:transferId/cancel')
  cancelTransfer(
    @Req() req: AuthRequest,
    @Param('transferId') transferId: string
  ) {
    return this.governance.cancelOwnershipTransfer(
      req.user.userId,
      transferId
    );
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
  moderateMoment(
    @Req() req: AuthRequest,
    @Param('momentId') momentId: string,
    @Body() dto: ModerateProfileCircleContentDto
  ) {
    return this.governance.moderateMoment(req.user.userId, momentId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stories/:storyId/moderate')
  moderateStory(
    @Req() req: AuthRequest,
    @Param('storyId') storyId: string,
    @Body() dto: ModerateProfileCircleContentDto
  ) {
    return this.governance.moderateStory(req.user.userId, storyId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':circleId/family-relations')
  proposeFamilyRelation(
    @Req() req: AuthRequest,
    @Param('circleId') circleId: string,
    @Body() dto: CreateProfileFamilyRelationDto
  ) {
    return this.governance.proposeFamilyRelation(
      req.user.userId,
      circleId,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('family-relations/:relationId/action')
  familyRelationAction(
    @Req() req: AuthRequest,
    @Param('relationId') relationId: string,
    @Body() dto: ProfileFamilyRelationActionDto
  ) {
    return this.governance.familyRelationAction(
      req.user.userId,
      relationId,
      dto
    );
  }
}
