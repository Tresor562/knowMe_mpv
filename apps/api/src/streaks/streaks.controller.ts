import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StreaksService } from './streaks.service';

@UseGuards(JwtAuthGuard)
@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaks: StreaksService) {}

  @Get('me')
  me(
    @Req() req: { user: { userId: string } },
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.streaks.summary(req.user.userId, parsedLimit);
  }
}
