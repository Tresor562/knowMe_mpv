import { ForbiddenException } from '@nestjs/common';
import { APP_THEMES, AppearanceService } from './appearance.service';

describe('AppearanceService', () => {
  function createService(options?: {
    preference?: Record<string, unknown> | null;
    entitlementKeys?: string[];
  }) {
    const prisma = {
      userAppearancePreference: {
        findUnique: jest.fn().mockResolvedValue(options?.preference ?? null)
      },
      $transaction: jest.fn()
    };
    const entitlements = {
      listForUser: jest.fn().mockResolvedValue({
        entitlements: (options?.entitlementKeys ?? []).map((key) => ({ key }))
      })
    };
    const audit = { record: jest.fn() };
    return {
      service: new AppearanceService(prisma as never, entitlements as never, audit as never),
      prisma,
      entitlements,
      audit
    };
  }

  const premiumPreference = {
    userId: 'user-1',
    selectedThemeKey: 'galaxy-ultra',
    secondaryThemeKey: null,
    themeBlendMode: 'OFF',
    selectedIconPackKey: null,
    selectedAppIconKey: null,
    contrast: 'STANDARD',
    reduceTransparency: false,
    animationsEnabled: true,
    animatedIconsEnabled: true,
    uiSoundsEnabled: false,
    weatherEffectsEnabled: false,
    effectIntensity: 'BALANCED',
    automaticRotationMode: 'OFF',
    version: 4,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z')
  };

  it('keeps the canonical catalog at exactly 40 free and 60 Premium themes', () => {
    expect(APP_THEMES).toHaveLength(100);
    expect(APP_THEMES.filter((theme) => theme.tier === 'FREE')).toHaveLength(40);
    expect(APP_THEMES.filter((theme) => theme.tier === 'PREMIUM')).toHaveLength(60);
    expect(new Set(APP_THEMES.map((theme) => theme.key)).size).toBe(100);
    expect(APP_THEMES.map((theme) => theme.order)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1)
    );
  });

  it('returns safe defaults and locks Premium personalization without entitlements', async () => {
    const { service } = createService();
    const response = await service.getForUser('user-1');

    expect(response.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'system',
        effectiveThemeKey: 'system',
        effectiveIconPackKey: 'soft-glass',
        effectiveAppIconKey: 'classique-knowme',
        contrast: 'STANDARD',
        reduceTransparency: false,
        animationsEnabled: true,
        animatedIconsEnabled: true,
        uiSoundsEnabled: false,
        weatherEffectsEnabled: false,
        effectIntensity: 'BALANCED',
        version: 0,
        fallbackReason: null
      })
    );
    expect(response.themes).toHaveLength(100);
    expect(response.iconPacks).toHaveLength(25);
    expect(response.themes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'light-minimal', locked: false }),
        expect.objectContaining({ key: 'galaxy-ultra', locked: true })
      ])
    );
  });

  it('falls back safely when a stored Premium theme loses its entitlement', async () => {
    const { service } = createService({ preference: premiumPreference });

    const response = await service.getForUser('user-1');
    expect(response.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'galaxy-ultra',
        effectiveThemeKey: 'system',
        effectiveAppIconKey: 'classique-knowme',
        fallbackReason: 'ENTITLEMENT_MISSING'
      })
    );
  });

  it('does not grant a Premium app icon through premium.themes alone', async () => {
    const themesOnly = createService({
      preference: premiumPreference,
      entitlementKeys: ['premium.themes']
    });
    const themesOnlyResponse = await themesOnly.service.getForUser('user-1');

    expect(themesOnlyResponse.preference).toEqual(
      expect.objectContaining({
        effectiveThemeKey: 'galaxy-ultra',
        effectiveIconPackKey: 'cosmic',
        effectiveAppIconKey: 'classique-knowme'
      })
    );
    expect(
      themesOnlyResponse.appIcons.find((icon) => icon.key === 'galaxy')
    ).toEqual(expect.objectContaining({ locked: true }));

    const withAppIcons = createService({
      preference: premiumPreference,
      entitlementKeys: ['premium.themes', 'premium.app_icons']
    });
    const completeResponse = await withAppIcons.service.getForUser('user-1');

    expect(completeResponse.preference.effectiveAppIconKey).toBe('galaxy');
    expect(
      completeResponse.appIcons.find((icon) => icon.key === 'galaxy')
    ).toEqual(expect.objectContaining({ locked: false }));
  });

  it('rejects a Premium theme before any preference mutation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.update('user-1', { themeKey: 'galaxy-ultra', expectedVersion: 0 })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exposes animation, accessibility and server-authority guarantees', () => {
    const { service } = createService();
    expect(service.policy()).toEqual(
      expect.objectContaining({
        themeCount: 100,
        freeThemeCount: 40,
        premiumThemeCount: 60,
        animatedThemesAllowed: true,
        animationsCanBeDisabled: true,
        uiSoundsOptionalAndDisabledByDefault: true,
        functionalAdvantagesAllowed: false,
        serverAuthoritativePreference: true,
        synchronizedVersioning: true,
        safeFallbackThemeKey: 'system',
        defaultAppIconKey: 'classique-knowme',
        seasonalAvailabilityIsServerDriven: true,
        weatherEffectsRequirePermission: true
      })
    );
  });
});
