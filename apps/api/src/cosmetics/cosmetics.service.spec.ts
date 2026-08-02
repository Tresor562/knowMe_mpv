import { CosmeticsService } from './cosmetics.service';

describe('CosmeticsService', () => {
  const service = new CosmeticsService({} as never, {} as never);

  it('keeps cosmetics visual-only and server-authoritative', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        visualOnly: true,
        gameplayEffectsAllowed: false,
        purchasesEnabled: false,
        paidPriorityAllowed: false,
        ownershipRequired: true,
        oneItemPerSlot: true,
        serverAuthoritativeInventory: true,
        immutablePublishedVersions: true
      })
    );
  });

  it('checks bounded availability windows', () => {
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

  it('never permits an item to cross equipment slots', () => {
    expect(service.slotMatches('AVATAR_FRAME', 'AVATAR_FRAME')).toBe(true);
    expect(service.slotMatches('AVATAR_FRAME', 'CHAT_BUBBLE')).toBe(false);
  });
});
