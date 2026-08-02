import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateAttestationChallengeDto,
  VerifyAttestationDto
} from './dto/integrity.dto';
import { IntegrityService } from './integrity.service';

type AuthenticatedRequest = {
  user: { userId: string; sessionId?: string };
};

@UseGuards(JwtAuthGuard)
@Controller('integrity')
export class IntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('challenges')
  createChallenge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAttestationChallengeDto
  ) {
    return this.integrity.createChallenge(
      req.user.userId,
      req.user.sessionId,
      dto
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify')
  verify(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyAttestationDto
  ) {
    return this.integrity.verify(req.user.userId, req.user.sessionId, dto);
  }

  @Get('me')
  mine(@Req() req: AuthenticatedRequest) {
    return this.integrity.listMine(req.user.userId);
  }
}
