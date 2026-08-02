import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from '../moderation/moderation.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly moderation: ModerationService
  ) {}

  @Post()
  async create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateReportDto
  ) {
    await this.moderation.assertAllowed({
      actorId: req.user.userId,
      action: 'REPORT_CREATE',
      content: `${dto.targetType}:${dto.targetId}:${dto.reason}`,
      targetId: `${dto.targetType}:${dto.targetId}`
    });
    return this.reports.create(req.user.userId, dto);
  }

  @Get('mine')
  mine(@Req() req: { user: { userId: string } }) {
    return this.reports.mine(req.user.userId);
  }
}
