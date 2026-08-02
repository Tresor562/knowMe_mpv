import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CosmeticsService } from './cosmetics.service';
import {
  CreateCosmeticItemDto,
  EquipCosmeticDto,
  GrantCosmeticItemDto,
  RevokeCosmeticOwnershipDto
} from './dto/cosmetics.dto';

@UseGuards(JwtAuthGuard)
@Controller('cosmetics')
export class CosmeticsController {
  constructor(private readonly cosmetics: CosmeticsService) {}

  @Get('catalog')
  catalog() {
    return this.cosmetics.catalog();
  }

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.cosmetics.me(req.user.userId);
  }

  @Put('equipment/:slot')
  equip(
    @Req() req: { user: { userId: string } },
    @Param('slot') slot: string,
    @Body() dto: EquipCosmeticDto
  ) {
    return this.cosmetics.equip(req.user.userId, slot, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.COSMETICS_MANAGE)
@Controller('admin/cosmetics')
export class AdminCosmeticsController {
  constructor(private readonly cosmetics: CosmeticsService) {}

  @Post('items')
  createItem(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateCosmeticItemDto
  ) {
    return this.cosmetics.createItem(req.user.userId, dto);
  }

  @Post('grants')
  grant(
    @Req() req: { user: { userId: string } },
    @Body() dto: GrantCosmeticItemDto
  ) {
    return this.cosmetics.grant(req.user.userId, dto);
  }

  @Patch('grants/:id/revoke')
  revoke(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: RevokeCosmeticOwnershipDto
  ) {
    return this.cosmetics.revoke(req.user.userId, id, dto);
  }
}
