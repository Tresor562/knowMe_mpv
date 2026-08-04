import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AffinityGamePolicyService } from './affinity-game-policy.service';
import { AffinityReplayPrivacyService } from './affinity-replay-privacy.service';
import { CreateGameSessionDto } from './dto/create-game-session.dto';
import { SubmitGameActionDto } from './dto/submit-game-action.dto';
import { GamePlatformService } from './game-platform.service';

@Controller('games')
export class GamePlatformController {
  constructor(
    private readonly games: GamePlatformService,
    private readonly affinityPolicy: AffinityGamePolicyService,
    private readonly affinityReplay: AffinityReplayPrivacyService
  ) {}

  @Get('catalog')
  catalog() {
    return this.games.catalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  mine(
    @Req() req: { user: { userId: string } },
    @Query('status') status?: string
  ) {
    return this.games.listMine(req.user.userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions')
  async create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateGameSessionDto
  ) {
    if (dto.gameKey === 'affinity-mirror') {
      await this.affinityPolicy.assertCanInviteByUsernames(
        req.user.userId,
        dto.opponentUsernames
      );
    }
    return this.games.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId')
  get(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    return this.games.view(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/join')
  join(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    return this.games.join(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/reconnect')
  reconnect(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    return this.games.reconnect(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/actions')
  action(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitGameActionDto
  ) {
    return this.games.submitAction(req.user.userId, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/abandon')
  abandon(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    return this.games.abandon(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  cancel(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    return this.games.cancel(req.user.userId, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions/:sessionId/replay')
  async replay(
    @Req() req: { user: { userId: string } },
    @Param('sessionId') sessionId: string
  ) {
    const replay = await this.games.replay(req.user.userId, sessionId);
    return this.affinityReplay.sanitize(replay);
  }
}
