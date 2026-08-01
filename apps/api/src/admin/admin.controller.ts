import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
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

  @Patch('users/:id/suspension')
  suspend(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { suspended: boolean }
  ) {
    return this.admin.suspendUser(req.user.userId, id, Boolean(body.suspended));
  }
}
