import {
  AVATAR_FREE_STARTER_KIT,
  AvatarItemDefinition,
  assertAvatarPurchaseAllowed,
  avatarUniversePolicy,
  calculateAvatarItemPrice,
  calculateReadyAvatarBundlePrice,
  hasCompleteFreeNormalAvatar,
  validateAvatarItem,
  validatePersonality
} from './avatar-universe.domain';

function premiumItem(overrides: Partial<AvatarItemDefinition> = {}): AvatarItemDefinition {
  return {
    key: 'neon-ronin-blade',
    name: 'Lame du Ronin Néon',
    slot: 'AVATAR_WEAPON_STYLE',
    rarity: 'LEGENDARY',
    themeFamily: 'NEON_RONIN',
    acquisitionMode: 'PREMIUM_KNOWCOINS',
    styleScore: 95,
    craftsmanshipScore: 90,
    animationComplexity: 70,
    scarcityMultiplierBps: 18_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true,
    ...overrides
  };
}

describe('avatar universe domain', () => {
  it('guarantees a complete normal avatar without KnowCoins', () => {
    expect(hasCompleteFreeNormalAvatar(AVATAR_FREE_STARTER_KIT)).toBe(true);
    for (const item of AVATAR_FREE_STARTER_KIT) {
      expect(calculateAvatarItemPrice(item)).toBe(0);
    }
  });

  it('makes highly styled, animated and scarce items more expensive', () => {
    const simple = premiumItem({
      acquisitionMode: 'KNOWCOINS',
      rarity: 'COMMON',
      styleScore: 10,
      craftsmanshipScore: 10,
      animationComplexity: 0,
      scarcityMultiplierBps: 10_000
    });
    const elite = premiumItem();
    expect(calculateAvatarItemPrice(elite)).toBeGreaterThan(
      calculateAvatarItemPrice(simple)
    );
  });

  it('requires a server-confirmed Premium entitlement and KnowCoins', () => {
    const item = premiumItem();
    expect(() =>
      assertAvatarPurchaseAllowed(item, {
        hasPremiumEntitlement: false,
        knowCoinBalance: 100_000
      })
    ).toThrow('Premium');

    expect(() =>
      assertAvatarPurchaseAllowed(item, {
        hasPremiumEntitlement: true,
        knowCoinBalance: 1
      })
    ).toThrow('Solde KnowCoins insuffisant');

    expect(
      assertAvatarPurchaseAllowed(item, {
        hasPremiumEntitlement: true,
        knowCoinBalance: 100_000
      })
    ).toBe(calculateAvatarItemPrice(item));
  });

  it('caps bundle discounts to protect the economy', () => {
    const items = [premiumItem({ acquisitionMode: 'KNOWCOINS' })];
    const maxDiscountPrice = calculateReadyAvatarBundlePrice(items, 2_500);
    expect(calculateReadyAvatarBundlePrice(items, 9_000)).toBe(maxDiscountPrice);
  });

  it('rejects direct cultural copies unless an explicit license exists', () => {
    expect(() =>
      validateAvatarItem(
        premiumItem({
          originalDesign: false,
          licensedReferenceId: null
        })
      )
    ).toThrow('licence explicite');

    expect(() =>
      validateAvatarItem(
        premiumItem({
          originalDesign: false,
          licensedReferenceId: 'licensed-collab-2026-001'
        })
      )
    ).not.toThrow();
  });

  it('validates personality intensity values', () => {
    expect(() =>
      validatePersonality({
        archetype: 'MYSTERIOUS',
        confidence: 80,
        expressiveness: 40,
        energy: 50,
        warmth: 25,
        humor: 20,
        mystery: 95,
        idleAnimation: 'shadow-breath',
        signaturePose: 'silent-guardian',
        greetingStyle: 'minimal',
        emotePackKey: 'mysterious-core'
      })
    ).not.toThrow();
  });

  it('keeps every cosmetic visual-only', () => {
    expect(avatarUniversePolicy()).toMatchObject({
      premiumFlagsTrustedFromClient: false,
      freeCompleteAvatarRequired: true,
      directFranchiseCopiesAllowed: false,
      fictionalStylizedWeaponsAllowed: true,
      realWeaponPerformanceSimulationAllowed: false,
      visualOnly: true
    });
  });
});
