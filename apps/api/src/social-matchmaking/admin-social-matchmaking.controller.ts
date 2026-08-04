import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SocialConnectionOperationsService } from './social-connection-operations.service';
import { SocialMatchmakingMaintenanceService } from './social-matchmaking-maintenance.service';
import { SocialMatchmakingService } from './social-matchmaking.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/social-matchmaking')
export class AdminSocialMatchmakingController {
  constructor(
    private readonly matchmaking: SocialMatchmakingService,
    private readonly connections: SocialConnectionOperationsService,
    private readonly maintenance: SocialMatchmakingMaintenanceService
  ) {}

  @RequirePermissions(PERMISSIONS.MATCHMAKING_MANAGE)
  @Get('operations')
  async operations(@Query('status') status?: string) {
    const [matchmaking, postAcceptanceConnection] = await Promise.all([
      this.matchmaking.operations(status),
      this.connections.snapshot()
    ]);
    return { ...matchmaking, postAcceptanceConnection };
  }

  @RequirePermissions(PERMISSIONS.MATCHMAKING_MANAGE)
  @Post('maintenance/tick')
  tick() {
    return this.maintenance.tick();
  }
}
