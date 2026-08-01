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
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  GrantEntitlementDto,
  RevokeEntitlementDto
} from './dto/entitlement.dto';
import { RequireEntitlements } from './entitlements.decorator';
import { EntitlementsGuard } from './entitlements.guard';
import { EntitlementsService } from './entitlements.service';

@UseGuards(JwtAuthGuard)
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.entitlements.listForUser(req.user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.ENTITLEMENTS_MANAGE)
@Controller('admin/entitlements')
export class AdminEntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get('grants')
  list(@Query('userId') userId?: string) {
    return this.entitlements.listAdmin(userId);
  }

  @Post('grants')
  grant(
    @Req() req: { user: { userId: string } },
    @Body() dto: GrantEntitlementDto
  ) {
    return this.entitlements.grant(req.user.userId, dto);
  }

  @Patch('grants/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeEntitlementDto
  ) {
    return this.entitlements.revoke(req.user.userId, id, dto);
  }
}

@UseGuards(JwtAuthGuard, EntitlementsGuard)
@Controller('exclusive')
export class ExclusiveFeaturesController {
  @RequireEntitlements('premium.core')
  @Get('premium-insights')
  premiumInsights(@Req() req: { user: { userId: string } }) {
    return {
      accountId: req.user.userId,
      entitlement: 'premium.core',
      access: 'granted',
      message: 'Fonctionnalité Premium autorisée par le serveur.'
    };
  }
}
