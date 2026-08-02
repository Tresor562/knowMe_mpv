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
import { CosmeticsService } from './cosmetics.service';
import {
  CreateCosmeticDefinitionDto,
  EquipCosmeticDto,
  GrantCosmeticDto,
  RevokeCosmeticGrantDto
} from './dto/cosmetic.dto';

@UseGuards(JwtAuthGuard)
@Controller('cosmetics')
export class CosmeticsController {
  constructor(private readonly cosmetics: CosmeticsService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.cosmetics.inventory(req.user.userId);
  }

  @Patch('equipment/:slot')
  equip(
    @Req() req: { user: { userId: string } },
    @Param('slot') slot: string,
    @Body() dto: EquipCosmeticDto
  ) {
    return this.cosmetics.equip(req.user.userId, slot, dto.grantId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.REWARDS_MANAGE)
@Controller('admin/cosmetics')
export class AdminCosmeticsController {
  constructor(private readonly cosmetics: CosmeticsService) {}

  @Get('catalog')
  catalog() {
    return this.cosmetics.listCatalog();
  }

  @Post('definitions')
  createDefinition(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateCosmeticDefinitionDto
  ) {
    return this.cosmetics.createDefinition(req.user.userId, dto);
  }

  @Get('grants')
  grants(@Query('userId') userId?: string) {
    return this.cosmetics.listGrants(userId?.trim());
  }

  @Post('grants')
  grant(
    @Req() req: { user: { userId: string } },
    @Body() dto: GrantCosmeticDto
  ) {
    return this.cosmetics.grant(req.user.userId, dto);
  }

  @Patch('grants/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeCosmeticGrantDto
  ) {
    return this.cosmetics.revoke(req.user.userId, id, dto.reason);
  }
}
