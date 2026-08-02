import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateWeeklyLeaderboardPreferenceDto } from './dto/leaderboard-preference.dto';
import { LeaderboardsService } from './leaderboards.service';

@UseGuards(JwtAuthGuard)
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get('weekly')
  weekly(@Req() req: { user: { userId: string } }) {
    return this.leaderboards.weekly(req.user.userId);
  }

  @Patch('weekly/preferences')
  setWeeklyPreference(
    @Req() req: { user: { userId: string } },
    @Body() dto: UpdateWeeklyLeaderboardPreferenceDto
  ) {
    return this.leaderboards.setWeeklyPreference(
      req.user.userId,
      dto.enabled,
      dto.displayAlias
    );
  }
}
