import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AppearanceController } from './appearance.controller';
import { AppearanceService } from './appearance.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [AppearanceController],
  providers: [AppearanceService],
  exports: [AppearanceService]
})
export class AppearanceModule {}
