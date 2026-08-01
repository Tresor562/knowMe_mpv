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
import {
  CreateRewardPolicyDto,
  SetRewardPolicyStatusDto
} from './dto/reward-policy.dto';
import { RewardsService } from './rewards.service';

@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('preview')
  preview(@Query('eventType') eventType?: string) {
    return this.rewards.preview(eventType);
  }

  @Get('me')
  history(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.rewards.history(
      req.user.userId,
      cursor?.trim(),
      Number.parseInt(limit ?? '30', 10) || 30
    );
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.REWARDS_MANAGE)
@Controller('admin/rewards')
export class AdminRewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('policies')
  policies() {
    return this.rewards.listPolicies();
  }

  @Post('policies')
  createPolicy(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateRewardPolicyDto
  ) {
    return this.rewards.createPolicy(req.user.userId, dto);
  }

  @Patch('policies/:id/status')
  setPolicyStatus(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SetRewardPolicyStatusDto
  ) {
    return this.rewards.setPolicyStatus(req.user.userId, id, dto);
  }

  @Get('events')
  events(
    @Query('userId') userId?: string,
    @Query('status') status?: string
  ) {
    return this.rewards.listEvents(userId?.trim(), status?.trim());
  }
}
