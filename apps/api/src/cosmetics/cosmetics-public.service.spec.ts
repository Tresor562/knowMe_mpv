import { CosmeticsPublicService } from './cosmetics-public.service';

describe('CosmeticsPublicService', () => {
  const service = new CosmeticsPublicService({} as never);

  it('never lets cosmetic visibility exceed profile visibility', () => {
    expect(service.resolveVisibility('PRIVATE', 'PUBLIC')).toBe('PRIVATE');
    expect(service.resolveVisibility('FRIENDS', 'PUBLIC')).toBe('FRIENDS');
    expect(service.resolveVisibility('PUBLIC', 'FRIENDS')).toBe('FRIENDS');
    expect(service.resolveVisibility('PUBLIC', 'FOLLOW_PROFILE')).toBe('PUBLIC');
  });

  it('allows owners, public viewers and accepted friends only', () => {
    expect(service.canView('owner', 'owner', 'PRIVATE', false)).toBe(true);
    expect(service.canView('owner', 'viewer', 'PUBLIC', false)).toBe(true);
    expect(service.canView('owner', 'friend', 'FRIENDS', true)).toBe(true);
    expect(service.canView('owner', 'viewer', 'FRIENDS', false)).toBe(false);
    expect(service.canView('owner', 'friend', 'PRIVATE', true)).toBe(false);
  });

  it('falls back when an equipped asset is inactive or outside its window', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(
      service.isAvailable(
        {
          active: true,
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: new Date('2026-08-03T00:00:00.000Z')
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
          startsAt: new Date('2026-08-03T00:00:00.000Z'),
          endsAt: null
        },
        now
      )
    ).toBe(false);
  });

  it('does not expose purchase or acquisition metadata', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        serverResolved: true,
        acquisitionSourceExposed: false,
        purchasePriceExposed: false,
        profileVisibilityIsUpperBound: true,
        hiddenSlotsOmitted: true,
        inactiveAssetsFallbackSafely: true,
        gameplayEffectsAllowed: false,
        paidPriorityAllowed: false
      })
    );
  });
});
