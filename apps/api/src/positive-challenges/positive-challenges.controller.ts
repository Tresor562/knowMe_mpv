import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePositiveChallengeDto } from './dto/positive-challenge.dto';
import { PositiveChallengesService } from './positive-challenges.service';

@UseGuards(JwtAuthGuard)
@Controller('positive-challenges')
export class PositiveChallengesController {
  constructor(private readonly positiveChallenges: PositiveChallengesService) {}

  @Get('catalog')
  catalog() {
    return this.positiveChallenges.catalog();
  }

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.positiveChallenges.me(req.user.userId);
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreatePositiveChallengeDto
  ) {
    return this.positiveChallenges.create(req.user.userId, dto);
  }

  @Patch(':id/accept')
  accept(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.positiveChallenges.respond(req.user.userId, id, true);
  }

  @Patch(':id/decline')
  decline(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.positiveChallenges.respond(req.user.userId, id, false);
  }

  @Patch(':id/confirm')
  confirm(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.positiveChallenges.confirm(req.user.userId, id);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    return this.positiveChallenges.cancel(req.user.userId, id);
  }
}
