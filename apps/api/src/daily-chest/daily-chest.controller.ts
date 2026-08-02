import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DailyChestService } from './daily-chest.service';

@UseGuards(JwtAuthGuard)
@Controller('daily-chest')
export class DailyChestController {
  constructor(private readonly dailyChest: DailyChestService) {}

  @Get('today')
  today(@Req() req: { user: { userId: string } }) {
    return this.dailyChest.today(req.user.userId);
  }

  @Post('claim')
  claim(@Req() req: { user: { userId: string } }) {
    return this.dailyChest.claim(req.user.userId);
  }
}
