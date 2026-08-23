import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitGameActionDto } from '../games/dto/submit-game-action.dto';
import { CreateGuestGameSessionDto } from './guest-game.dto';
import { GuestGameplayService } from './guest-gameplay.service';
import { CreateGuestSessionDto } from './guest-play.dto';
import { GuestPlayService } from './guest-play.service';

@Controller('guest')
export class GuestPlayController {
  constructor(
    private readonly guests: GuestPlayService,
    private readonly gameplay: GuestGameplayService
  ) {}

  @Get('policy')
  policy() {
    return this.guests.policy();
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('sessions')
  create(@Body() dto: CreateGuestSessionDto) {
    return this.guests.createSession(dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('session')
  session(@Headers('authorization') authorization?: string) {
    return this.guests.sessionFromAuthorization(authorization);
  }

  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Delete('session')
  revoke(@Headers('authorization') authorization?: string) {
    return this.guests.revokeFromAuthorization(authorization);
  }

  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('games/:gameKey/sessions')
  createGame(
    @Headers('authorization') authorization: string | undefined,
    @Param('gameKey') gameKey: string,
    @Body() dto: CreateGuestGameSessionDto
  ) {
    return this.gameplay.createFromAuthorization(authorization, gameKey, dto);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('games/sessions/:sessionId')
  viewGame(
    @Headers('authorization') authorization: string | undefined,
    @Param('sessionId') sessionId: string
  ) {
    return this.gameplay.viewFromAuthorization(authorization, sessionId);
  }

  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @Post('games/sessions/:sessionId/actions')
  submitGameAction(
    @Headers('authorization') authorization: string | undefined,
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitGameActionDto
  ) {
    return this.gameplay.submitActionFromAuthorization(authorization, sessionId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('convert')
  convert(
    @Req() req: { user: { userId: string } },
    @Headers('x-knowme-guest-token') guestToken?: string
  ) {
    return this.guests.convertToUser(guestToken, req.user.userId);
  }
}
