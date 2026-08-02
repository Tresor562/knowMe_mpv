import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { DailyChestController } from './daily-chest.controller';
import { DailyChestService } from './daily-chest.service';

@Module({
  imports: [WalletModule],
  controllers: [DailyChestController],
  providers: [DailyChestService],
  exports: [DailyChestService]
})
export class DailyChestModule {}
