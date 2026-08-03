import { CosmeticPresetsService } from './cosmetic-presets.service';

describe('CosmeticPresetsService', () => {
  const service = new CosmeticPresetsService({} as never, {} as never);

  it('normalizes preset names deterministically', () => {
    expect(service.normalizeName('  Nuit   Nébuleuse  ')).toBe('nuit nébuleuse');
  });

  it('enforces visual-only, owned and atomic activation rules', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        visualOnly: true,
        gameplayEffectsAllowed: false,
        paidPriorityAllowed: false,
        ownershipRequired: true,
        atomicActivation: true,
        idempotentActivation: true,
        hiddenSlotsRespected: true,
        unavailableItemsPruned: true
      })
    );
  });

  it('accepts only active items inside their availability window', () => {
    const now = new Date('2026-08-03T08:00:00.000Z');
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2026-08-04T00:00:00.000Z')
        },
        now
      )
    ).toBe(true);
    expect(
      service.isAvailable(
        {
          active: false,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null
        },
        now
      )
    ).toBe(false);
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-04T00:00:00.000Z'),
          endsAt: null
        },
        now
      )
    ).toBe(false);
  });
});
