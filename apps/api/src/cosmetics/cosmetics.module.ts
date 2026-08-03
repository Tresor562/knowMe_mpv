import { Module } from '@nestjs/common';
import { CosmeticPresetsController } from './cosmetic-presets.controller';
import { CosmeticPresetsService } from './cosmetic-presets.service';
import { CosmeticsPublicController } from './cosmetics-public.controller';
import { CosmeticsPublicService } from './cosmetics-public.service';
import {
  AdminCosmeticsShopController,
  CosmeticsShopController
} from './cosmetics-shop.controller';
import { CosmeticsShopService } from './cosmetics-shop.service';
import { AdminCosmeticsController, CosmeticsController } from './cosmetics.controller';
import { CosmeticsService } from './cosmetics.service';

@Module({
  controllers: [
    CosmeticsController,
    AdminCosmeticsController,
    CosmeticsShopController,
    AdminCosmeticsShopController,
    CosmeticsPublicController,
    CosmeticPresetsController
  ],
  providers: [
    CosmeticsService,
    CosmeticsShopService,
    CosmeticsPublicService,
    CosmeticPresetsService
  ],
  exports: [
    CosmeticsService,
    CosmeticsShopService,
    CosmeticsPublicService,
    CosmeticPresetsService
  ]
})
export class CosmeticsModule {}
