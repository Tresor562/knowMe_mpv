import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RuntimeExperienceService } from './runtime-experience.service';

@Controller('runtime-experience')
export class RuntimeExperienceController {
  constructor(private readonly experience: RuntimeExperienceService) {}
  @Get()
  config() { return this.experience.read(); }
  @Get('badges/:username')
  badges(@Param('username') username: string) {
    return this.experience.badgesForUsername(username);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/runtime-experience')
export class AdminRuntimeExperienceController {
  constructor(private readonly experience: RuntimeExperienceService) {}
  @Put()
  @RequirePermissions(PERMISSIONS.FEATURE_FLAGS_MANAGE)
  publish(@Req() req: { user: { userId: string } }, @Body() body: unknown) {
    return this.experience.publish(req.user.userId, body);
  }
  @Put('badges/grants')
  @RequirePermissions(PERMISSIONS.COSMETICS_MANAGE)
  grant(@Req() req: { user: { userId: string } }, @Body() body: unknown) {
    return this.experience.changeGrant(req.user.userId, body);
  }
  @Delete('badges/grants')
  @RequirePermissions(PERMISSIONS.COSMETICS_MANAGE)
  revoke(@Req() req: { user: { userId: string } }, @Body() body: unknown) {
    return this.experience.changeGrant(req.user.userId, body, true);
  }
}
