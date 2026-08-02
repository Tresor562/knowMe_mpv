import { Module } from '@nestjs/common';
import { AdminCosmeticsController, CosmeticsController } from './cosmetics.controller';
import { CosmeticsService } from './cosmetics.service';

@Module({
  controllers: [CosmeticsController, AdminCosmeticsController],
  providers: [CosmeticsService],
  exports: [CosmeticsService]
})
export class CosmeticsModule {}
