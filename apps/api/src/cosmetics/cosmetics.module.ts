import { Module } from '@nestjs/common';
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
    AdminCosmeticsShopController
  ],
  providers: [CosmeticsService, CosmeticsShopService],
  exports: [CosmeticsService, CosmeticsShopService]
})
export class CosmeticsModule {}
