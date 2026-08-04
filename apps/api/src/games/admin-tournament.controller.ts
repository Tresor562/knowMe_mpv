import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GovernTournamentDto } from './dto/govern-tournament.dto';
import { ResolveTournamentMatchDto } from './dto/resolve-tournament-match.dto';
import { TournamentService } from './tournament.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/tournaments')
export class AdminTournamentController {
  constructor(private readonly tournaments: TournamentService) {}

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Get()
  operations(@Query('status') status?: string) {
    return this.tournaments.operations(status);
  }

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Patch(':tournamentId/matches/:matchId/resolve')
  resolve(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Param('matchId') matchId: string,
    @Body() dto: ResolveTournamentMatchDto
  ) {
    return this.tournaments.resolveMatch(
      req.user.userId,
      tournamentId,
      matchId,
      dto
    );
  }

  @RequirePermissions(PERMISSIONS.GAMES_MANAGE)
  @Patch(':tournamentId/cancel')
  cancel(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: GovernTournamentDto
  ) {
    return this.tournaments.governCancel(
      req.user.userId,
      tournamentId,
      dto.reason
    );
  }
}
