import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { RegisterTournamentEntrantDto } from './dto/register-tournament-entrant.dto';
import { TournamentOperationDto } from './dto/tournament-operation.dto';
import { TournamentService } from './tournament.service';

@UseGuards(JwtAuthGuard)
@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournaments: TournamentService) {}

  @Get('open')
  open() {
    return this.tournaments.listOpen();
  }

  @Get('mine')
  mine(@Req() req: { user: { userId: string } }) {
    return this.tournaments.listMine(req.user.userId);
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateTournamentDto
  ) {
    return this.tournaments.create(req.user.userId, dto);
  }

  @Get(':tournamentId')
  get(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string
  ) {
    return this.tournaments.view(req.user.userId, tournamentId);
  }

  @Post(':tournamentId/registration/open')
  openRegistration(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TournamentOperationDto
  ) {
    return this.tournaments.openRegistration(req.user.userId, tournamentId, dto);
  }

  @Post(':tournamentId/entrants')
  register(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: RegisterTournamentEntrantDto
  ) {
    return this.tournaments.registerEntrant(req.user.userId, tournamentId, dto);
  }

  @Post(':tournamentId/invitations/accept')
  acceptInvitation(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TournamentOperationDto
  ) {
    return this.tournaments.acceptInvitation(req.user.userId, tournamentId, dto);
  }

  @Post(':tournamentId/start')
  start(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TournamentOperationDto
  ) {
    return this.tournaments.start(req.user.userId, tournamentId, dto);
  }

  @Post(':tournamentId/matches/:matchId/sync')
  sync(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Param('matchId') matchId: string
  ) {
    return this.tournaments.syncMatch(req.user.userId, tournamentId, matchId);
  }

  @Post(':tournamentId/withdraw')
  withdraw(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TournamentOperationDto
  ) {
    return this.tournaments.withdraw(req.user.userId, tournamentId, dto);
  }

  @Delete(':tournamentId')
  cancel(
    @Req() req: { user: { userId: string } },
    @Param('tournamentId') tournamentId: string,
    @Body() dto: TournamentOperationDto
  ) {
    return this.tournaments.cancel(req.user.userId, tournamentId, dto);
  }
}
