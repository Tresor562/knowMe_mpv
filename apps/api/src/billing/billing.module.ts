import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AdminBillingController, BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AccessControlModule, EntitlementsModule],
  controllers: [BillingController, AdminBillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}
