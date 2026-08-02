import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressionService } from './progression.service';

@UseGuards(JwtAuthGuard)
@Controller('progression')
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get('me')
  me(
    @Req() req: { user: { userId: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.progression.summary(req.user.userId, cursor, parsedLimit);
  }
}
