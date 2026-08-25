import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { AccountRecoveryRetentionService } from '../auth/account-recovery-retention.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { MediaQuarantineOpsService } from './media-quarantine-ops.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly accountRecoveryRetention: AccountRecoveryRetentionService,
    private readonly mediaQuarantineOps: MediaQuarantineOpsService
  ) {}

  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @Get('operations/account-recovery-retention')
  accountRecoveryRetentionStatus() {
    return this.accountRecoveryRetention.getMaintenanceSnapshot();
  }

  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @Get('operations/media-quarantine')
  mediaQuarantineStatus() {
    return this.mediaQuarantineOps.getSnapshot();
  }

  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @Get('reports')
  reports(@Query('status') status = 'OPEN') {
    return this.admin.listReports(status.toUpperCase());
  }

  @RequirePermissions(PERMISSIONS.REPORTS_RESOLVE)
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

  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @Get('audit-logs')
  auditLogs(
    @Query('requestId') requestId?: string,
    @Query('correlationId') correlationId?: string
  ) {
    return this.admin.listAuditLogs(requestId?.trim(), correlationId?.trim());
  }

  @RequirePermissions(PERMISSIONS.USER_SUSPENSION_MANAGE)
  @Patch('users/:id/suspension')
  suspend(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { suspended: boolean }
  ) {
    return this.admin.suspendUser(req.user.userId, id, Boolean(suspended));
  }
}
