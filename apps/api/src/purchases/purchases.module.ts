import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { IntegrityModule } from '../integrity/integrity.module';
import { ObservabilityModule } from '../observability/observability.module';
import { WalletModule } from '../wallet/wallet.module';
import {
  AdminPurchasesController,
  PurchasesController
} from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [AccessControlModule, IntegrityModule, ObservabilityModule, WalletModule],
  controllers: [PurchasesController, AdminPurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService]
})
export class PurchasesModule {}
