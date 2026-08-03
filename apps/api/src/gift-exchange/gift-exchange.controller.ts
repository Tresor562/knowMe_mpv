import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  calculateGiftResaleSettlement,
  giftExchangePolicy
} from './gift-exchange.domain';

type GiftSettlementQuoteDto = {
  priceKnowCoins: number;
  marketplaceFeeBps: number;
  creatorRoyaltyBps: number;
};

@Controller('gift-exchange')
export class GiftExchangeController {
  @Get('policy')
  policy() {
    return giftExchangePolicy();
  }

  @Post('quotes/resale-settlement')
  quoteResaleSettlement(@Body() dto: GiftSettlementQuoteDto) {
    return {
      ...calculateGiftResaleSettlement(
        dto.priceKnowCoins,
        dto.marketplaceFeeBps,
        dto.creatorRoyaltyBps
      ),
      serverAuthoritative: true
    };
  }
}
