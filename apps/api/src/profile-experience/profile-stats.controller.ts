import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileStatsService } from './profile-stats.service';

type AuthRequest = { user: { userId: string } };

@Controller('profile-stats')
export class ProfileStatsController {
  constructor(private readonly stats: ProfileStatsService) {}

  @Get('policy')
  policy() {
    return this.stats.policy();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  history(@Req() req: AuthRequest, @Query('take') take?: string) {
    const parsed = take ? Number.parseInt(take, 10) : 100;
    return this.stats.ownerHistory(
      req.user.userId,
      Number.isFinite(parsed) ? parsed : 100
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/rebuild')
  rebuild(@Req() req: AuthRequest) {
    return this.stats.rebuild(req.user.userId);
  }
}
