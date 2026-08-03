import { Module } from '@nestjs/common';
import { GiftExchangeController } from './gift-exchange.controller';

@Module({
  controllers: [GiftExchangeController]
})
export class GiftExchangeModule {}
