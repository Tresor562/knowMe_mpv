import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  AVATAR_FREE_STARTER_KIT,
  AvatarItemDefinition,
  avatarUniversePolicy,
  calculateAvatarItemPrice,
  calculateReadyAvatarBundlePrice,
  hasCompleteFreeNormalAvatar
} from './avatar-universe.domain';

type AvatarItemQuoteDto = {
  item: AvatarItemDefinition;
};

type AvatarBundleQuoteDto = {
  items: AvatarItemDefinition[];
  discountBps: number;
};

@Controller('avatar-universe')
export class AvatarUniverseController {
  @Get('policy')
  policy() {
    return avatarUniversePolicy();
  }

  @Get('starter-kit')
  starterKit() {
    return {
      items: AVATAR_FREE_STARTER_KIT,
      completeNormalAvatar: hasCompleteFreeNormalAvatar(AVATAR_FREE_STARTER_KIT),
      priceKnowCoins: 0
    };
  }

  @Post('quotes/item')
  quoteItem(@Body() dto: AvatarItemQuoteDto) {
    return {
      itemKey: dto.item.key,
      priceKnowCoins: calculateAvatarItemPrice(dto.item),
      serverAuthoritative: true
    };
  }

  @Post('quotes/bundle')
  quoteBundle(@Body() dto: AvatarBundleQuoteDto) {
    return {
      itemCount: dto.items.length,
      priceKnowCoins: calculateReadyAvatarBundlePrice(dto.items, dto.discountBps),
      serverAuthoritative: true
    };
  }
}
