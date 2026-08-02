import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PublishExperienceCurveDto } from './dto/experience-curve.dto';
import {
  CreateExperiencePolicyDto,
  SetExperiencePolicyStatusDto
} from './dto/experience-policy.dto';
import { ExperienceService } from './experience.service';

@UseGuards(JwtAuthGuard)
@Controller('experience')
export class ExperienceController {
  constructor(private readonly experience: ExperienceService) {}

  @Get('me')
  profile(@Req() req: { user: { userId: string } }) {
    return this.experience.profile(req.user.userId);
  }

  @Get('me/history')
  history(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.experience.history(
      req.user.userId,
      cursor?.trim(),
      Number.parseInt(limit ?? '30', 10) || 30
    );
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.EXPERIENCE_MANAGE)
@Controller('admin/experience')
export class AdminExperienceController {
  constructor(private readonly experience: ExperienceService) {}

  @Get('policies')
  policies() {
    return this.experience.listPolicies();
  }

  @Post('policies')
  createPolicy(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateExperiencePolicyDto
  ) {
    return this.experience.createPolicy(req.user.userId, dto);
  }

  @Patch('policies/:id/status')
  setPolicyStatus(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SetExperiencePolicyStatusDto
  ) {
    return this.experience.setPolicyStatus(req.user.userId, id, dto);
  }

  @Get('ledger')
  ledger(
    @Query('userId') userId?: string,
    @Query('status') status?: string
  ) {
    return this.experience.listLedger(userId?.trim(), status?.trim());
  }

  @Get('curves')
  curves() {
    return this.experience.listCurves();
  }

  @Post('curves')
  publishCurve(
    @Req() req: { user: { userId: string } },
    @Body() dto: PublishExperienceCurveDto
  ) {
    return this.experience.publishCurve(req.user.userId, dto);
  }
}
