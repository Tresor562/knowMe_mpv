import { Module } from '@nestjs/common';
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
    CosmeticsPublicController
  ],
  providers: [CosmeticsService, CosmeticsShopService, CosmeticsPublicService],
  exports: [CosmeticsService, CosmeticsShopService, CosmeticsPublicService]
})
export class CosmeticsModule {}
