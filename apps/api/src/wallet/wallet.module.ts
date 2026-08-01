import { Global, Module } from '@nestjs/common';
import { AdminWalletController, WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Global()
@Module({
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService]
})
export class WalletModule {}
