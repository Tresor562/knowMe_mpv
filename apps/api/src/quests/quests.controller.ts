import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestsService } from './quests.service';

@UseGuards(JwtAuthGuard)
@Controller('quests')
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get('today')
  today(@Req() req: { user: { userId: string } }) {
    return this.quests.today(req.user.userId);
  }
}
