import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ActivateStaffAccountDto,
  UpdateStaffAccountStatusDto
} from './dto/staff-account.dto';
import { StaffService } from './staff.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.STAFF_MANAGE)
@Controller('admin/staff-accounts')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  activate(
    @Req() req: { user: { userId: string } },
    @Body() dto: ActivateStaffAccountDto
  ) {
    return this.staff.activate(req.user.userId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateStaffAccountStatusDto
  ) {
    return this.staff.updateStatus(req.user.userId, id, dto);
  }
}
