import {
  publicSocialGift,
  SOCIAL_GIFT_CATALOG,
  socialGiftByKey
} from './social-gift.catalog';

describe('social gift catalog', () => {
  it('contains unique, active and server-priced gifts', () => {
    const keys = new Set<string>();
    const animations = new Set<string>();

    for (const gift of SOCIAL_GIFT_CATALOG) {
      expect(gift.active).toBe(true);
      expect(gift.version).toBeGreaterThan(0);
      expect(Number.isSafeInteger(gift.priceKnowCoins)).toBe(true);
      expect(gift.priceKnowCoins).toBeGreaterThan(0);
      expect(gift.priceKnowCoins).toBeLessThanOrEqual(10_000);
      expect(keys.has(gift.key)).toBe(false);
      expect(animations.has(gift.animationToken)).toBe(false);
      keys.add(gift.key);
      animations.add(gift.animationToken);
    }
  });

  it('publishes only visual and non-transferable semantics', () => {
    const gift = socialGiftByKey('spark');
    expect(gift).toBeDefined();

    expect(publicSocialGift(gift!)).toMatchObject({
      visualOnly: true,
      redeemable: false,
      transferable: false,
      resaleAllowed: false,
      gameplayEffectsAllowed: false
    });
  });

  it('normalizes gift keys without accepting unknown products', () => {
    expect(socialGiftByKey('  SPARK  ')?.key).toBe('spark');
    expect(socialGiftByKey('unknown-gift')).toBeUndefined();
  });
});
