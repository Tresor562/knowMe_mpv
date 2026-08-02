import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access-control/access-control.catalog';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PermissionsGuard } from '../access-control/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CosmeticsShopService } from './cosmetics-shop.service';
import {
  CreateCosmeticOfferDto,
  PurchaseCosmeticOfferDto
} from './dto/cosmetics-shop.dto';

@UseGuards(JwtAuthGuard)
@Controller('cosmetics/shop')
export class CosmeticsShopController {
  constructor(private readonly shopService: CosmeticsShopService) {}

  @Get()
  shop(@Req() req: { user: { userId: string } }) {
    return this.shopService.shop(req.user.userId);
  }

  @Get('purchases')
  history(@Req() req: { user: { userId: string } }) {
    return this.shopService.history(req.user.userId);
  }

  @Post('purchases')
  purchase(
    @Req() req: { user: { userId: string } },
    @Body() dto: PurchaseCosmeticOfferDto
  ) {
    return this.shopService.purchase(req.user.userId, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.COSMETICS_MANAGE)
@Controller('admin/cosmetics/offers')
export class AdminCosmeticsShopController {
  constructor(private readonly shopService: CosmeticsShopService) {}

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateCosmeticOfferDto
  ) {
    return this.shopService.createOffer(req.user.userId, dto);
  }
}
