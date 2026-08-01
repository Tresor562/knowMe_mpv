import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateReportDto
  ) {
    return this.reports.create(req.user.userId, dto);
  }

  @Get('mine')
  mine(@Req() req: { user: { userId: string } }) {
    return this.reports.mine(req.user.userId);
  }
}
