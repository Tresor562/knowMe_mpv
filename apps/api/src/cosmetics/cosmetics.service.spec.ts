import { AVATAR_ALL_SLOTS } from '../avatar-universe/avatar-universe.domain';
import { COSMETIC_RARITIES, COSMETIC_SLOTS } from './dto/cosmetics.dto';
import { CosmeticsService } from './cosmetics.service';

describe('CosmeticsService', () => {
  const service = new CosmeticsService({} as never, {} as never);

  it('keeps cosmetics visual-only and server-authoritative', () => {
    expect(service.policy()).toEqual(
      expect.objectContaining({
        visualOnly: true,
        gameplayEffectsAllowed: false,
        purchasesEnabled: true,
        paidPriorityAllowed: false,
        ownershipRequired: true,
        oneItemPerSlot: true,
        serverAuthoritativeInventory: true,
        immutablePublishedVersions: true
      })
    );
  });

  it('keeps Cosmetics aligned with every Avatar Universe slot', () => {
    for (const slot of AVATAR_ALL_SLOTS) {
      expect(COSMETIC_SLOTS).toContain(slot);
    }
    expect(COSMETIC_SLOTS).toEqual(
      expect.arrayContaining([
        'AVATAR_FOOTWEAR',
        'AVATAR_HEADWEAR',
        'AVATAR_BACK_ITEM',
        'AVATAR_HAND_ITEM',
        'AVATAR_WEAPON_STYLE',
        'AVATAR_COMPANION'
      ])
    );
  });

  it('supports the Avatar Universe rarity ladder', () => {
    expect(COSMETIC_RARITIES).toEqual([
      'COMMON',
      'UNCOMMON',
      'RARE',
      'EPIC',
      'LEGENDARY',
      'MYTHIC'
    ]);
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
    expect(service.slotMatches('AVATAR_HAIR', 'AVATAR_HAIR')).toBe(true);
    expect(service.slotMatches('AVATAR_HAIR', 'AVATAR_FACE')).toBe(false);
    expect(service.slotMatches('AVATAR_WEAPON_STYLE', 'AVATAR_WEAPON_STYLE')).toBe(true);
    expect(service.slotMatches('AVATAR_WEAPON_STYLE', 'AVATAR_HAND_ITEM')).toBe(false);
  });
});
