import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PERMISSIONS } from './access-control.catalog';
import { AccessControlService } from './access-control.service';
import { GrantRoleDto, RevokeRoleGrantDto } from './dto/access-control.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@UseGuards(JwtAuthGuard)
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessControlService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.access.me(req.user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.RBAC_MANAGE)
@Controller('admin/access-control')
export class AdminAccessControlController {
  constructor(private readonly access: AccessControlService) {}

  @Get('catalog')
  catalog() {
    return this.access.catalog();
  }

  @Get('grants')
  grants(@Query('userId') userId?: string) {
    return this.access.listGrants(userId?.trim());
  }

  @Post('grants')
  grant(
    @Req() req: { user: { userId: string } },
    @Body() dto: GrantRoleDto
  ) {
    return this.access.grant(req.user.userId, dto);
  }

  @Patch('grants/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeRoleGrantDto
  ) {
    return this.access.revoke(req.user.userId, id, dto);
  }
}
