import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GovernGameSessionDto } from './dto/govern-game-session.dto';
import { GamePlatformService } from './game-platform.service';
import { GameSessionMaintenanceService } from './game-session-maintenance.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/games')
export class AdminGamePlatformController {
  constructor(
    private readonly games: GamePlatformService,
    private readonly maintenance: GameSessionMaintenanceService
  ) {}

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Get('sessions')
  operations(@Query('status') status?: string) {
    return this.games.operations(status);
  }

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Patch('sessions/:sessionId/governance')
  govern(
    @Param('sessionId') sessionId: string,
    @Body() dto: GovernGameSessionDto
  ) {
    return this.games.govern('system-admin-route', sessionId, dto);
  }

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Post('maintenance/tick')
  tick() {
    return this.maintenance.tick();
  }
}
