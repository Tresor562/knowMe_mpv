import { ForbiddenException } from '@nestjs/common';
import { AppearanceService } from './appearance.service';

describe('AppearanceService', () => {
  function createService(options?: {
    preference?: Record<string, unknown> | null;
    entitlementKeys?: string[];
    hasAll?: boolean;
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
      }),
      hasAll: jest.fn().mockResolvedValue(options?.hasAll ?? false)
    };
    const audit = { record: jest.fn() };
    return {
      service: new AppearanceService(prisma as never, entitlements as never, audit as never),
      prisma,
      entitlements,
      audit
    };
  }

  it('returns system defaults and locks premium themes without entitlements', async () => {
    const { service } = createService();
    const response = await service.getForUser('user-1');

    expect(response.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'system',
        effectiveThemeKey: 'system',
        contrast: 'STANDARD',
        reduceTransparency: false,
        version: 0,
        fallbackReason: null
      })
    );
    expect(response.themes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'light', locked: false }),
        expect.objectContaining({ key: 'midnight', locked: true })
      ])
    );
  });

  it('falls back safely when a stored premium theme loses its entitlement', async () => {
    const { service } = createService({
      preference: {
        userId: 'user-1',
        selectedThemeKey: 'midnight',
        contrast: 'HIGH',
        reduceTransparency: true,
        version: 4,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      }
    });

    const response = await service.getForUser('user-1');
    expect(response.preference).toEqual(
      expect.objectContaining({
        selectedThemeKey: 'midnight',
        effectiveThemeKey: 'system',
        fallbackReason: 'ENTITLEMENT_MISSING',
        contrast: 'HIGH',
        reduceTransparency: true
      })
    );
  });

  it('rejects a premium theme before any preference mutation', async () => {
    const { service, prisma } = createService({ hasAll: false });

    await expect(
      service.update('user-1', { themeKey: 'ivory', expectedVersion: 0 })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exposes static, non-functional theme policy guarantees', () => {
    const { service } = createService();
    expect(service.policy()).toEqual(
      expect.objectContaining({
        staticOnly: true,
        animatedThemesAllowed: false,
        functionalAdvantagesAllowed: false,
        serverAuthoritativePreference: true,
        synchronizedVersioning: true,
        premiumThemesRequireEntitlement: true,
        safeFallbackThemeKey: 'system'
      })
    );
  });
});
