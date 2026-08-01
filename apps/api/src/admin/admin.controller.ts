import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AdminService } from './admin.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('reports')
  reports(@Query('status') status = 'OPEN') {
    return this.admin.listReports(status.toUpperCase());
  }

  @Patch('reports/:id')
  resolveReport(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    return this.admin.resolveReport(
      req.user.userId,
      id,
      String(body.status ?? '').toUpperCase()
    );
  }

  @Get('audit-logs')
  auditLogs() {
    return this.admin.listAuditLogs();
  }

  @Patch('users/:id/suspension')
  suspend(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { suspended: boolean }
  ) {
    return this.admin.suspendUser(req.user.userId, id, Boolean(body.suspended));
  }
}
