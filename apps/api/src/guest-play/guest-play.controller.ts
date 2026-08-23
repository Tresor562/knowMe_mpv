import { Body, Controller, Delete, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGuestSessionDto } from './guest-play.dto';
import { GuestPlayService } from './guest-play.service';

@Controller('guest')
export class GuestPlayController {
  constructor(private readonly guests: GuestPlayService) {}

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
