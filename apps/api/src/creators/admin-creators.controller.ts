import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatorsService } from './creators.service';
import { GovernCreatorProfileDto } from './dto/govern-creator-profile.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/creators')
export class AdminCreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @RequirePermissions(PERMISSIONS.CREATOR_MANAGE)
  @Patch(':userId/governance')
  govern(
    @Req() req: { user: { userId: string } },
    @Param('userId') userId: string,
    @Body() dto: GovernCreatorProfileDto
  ) {
    return this.creators.govern(
      req.user.userId,
      userId,
      dto.suspended,
      dto.reason
    );
  }
}
