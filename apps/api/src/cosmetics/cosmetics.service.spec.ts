import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AVATAR_ALL_SLOTS } from '../avatar-universe/avatar-universe.domain';
import { COSMETIC_RARITIES, COSMETIC_SLOTS } from './dto/cosmetics.dto';
import { CosmeticsService } from './cosmetics.service';

describe('CosmeticsService', () => {
  const service = new CosmeticsService({} as never, {} as never);

  it('keeps cosmetics visual-only and server-authoritative', () => {
    expect(service.policy()).toEqual(expect.objectContaining({ visualOnly:true, gameplayEffectsAllowed:false, purchasesEnabled:true, paidPriorityAllowed:false, ownershipRequired:true, oneItemPerSlot:true, serverAuthoritativeInventory:true, immutablePublishedVersions:true }));
  });

  it('keeps Cosmetics aligned with every Avatar Universe slot', () => {
    for (const slot of AVATAR_ALL_SLOTS) expect(COSMETIC_SLOTS).toContain(slot);
    expect(COSMETIC_SLOTS).toEqual(expect.arrayContaining(['AVATAR_FOOTWEAR','AVATAR_HEADWEAR','AVATAR_BACK_ITEM','AVATAR_HAND_ITEM','AVATAR_WEAPON_STYLE','AVATAR_COMPANION']));
  });

  it('supports the Avatar Universe rarity ladder', () => {
    expect(COSMETIC_RARITIES).toEqual(['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC']);
  });

  it('checks bounded availability windows', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(service.isAvailable({active:true,startsAt:new Date('2026-08-01T00:00:00.000Z'),endsAt:new Date('2026-08-03T00:00:00.000Z')},now)).toBe(true);
    expect(service.isAvailable({active:false,startsAt:new Date('2026-08-01T00:00:00.000Z'),endsAt:null},now)).toBe(false);
    expect(service.isAvailable({active:true,startsAt:new Date('2026-08-03T00:00:00.000Z'),endsAt:null},now)).toBe(false);
  });

  it('never permits an item to cross equipment slots', () => {
    expect(service.slotMatches('AVATAR_FRAME','AVATAR_FRAME')).toBe(true);
    expect(service.slotMatches('AVATAR_FRAME','CHAT_BUBBLE')).toBe(false);
    expect(service.slotMatches('AVATAR_HAIR','AVATAR_HAIR')).toBe(true);
    expect(service.slotMatches('AVATAR_HAIR','AVATAR_FACE')).toBe(false);
    expect(service.slotMatches('AVATAR_WEAPON_STYLE','AVATAR_WEAPON_STYLE')).toBe(true);
    expect(service.slotMatches('AVATAR_WEAPON_STYLE','AVATAR_HAND_ITEM')).toBe(false);
  });

  function replayService(ownership: { revokedAt: Date | null } | null, itemOverrides: Record<string, unknown> = {}) {
    const item = { id:'item-1', slot:'AVATAR_HAIR', active:true, startsAt:new Date('2026-01-01T00:00:00.000Z'), endsAt:null, avatarAssetManifest:{schemaVersion:1}, assetValidatedAt:new Date('2026-09-23T00:00:00.000Z'), ...itemOverrides };
    const prisma = {
      cosmeticEquipment:{ findUnique:jest.fn().mockResolvedValue({id:'equipment-1',userId:'user-1',slot:'AVATAR_HAIR',itemId:'item-1',item}) },
      cosmeticOwnership:{ findUnique:jest.fn().mockResolvedValue(ownership) }
    };
    return { service:new CosmeticsService(prisma as never, {record:jest.fn()} as never), prisma };
  }

  it('revalidates ownership before accepting an idempotent equip replay', async () => {
    const { service: replay, prisma } = replayService({revokedAt:null});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).resolves.toEqual(expect.objectContaining({replayed:true}));
    expect(prisma.cosmeticOwnership.findUnique).toHaveBeenCalledWith({where:{userId_itemId:{userId:'user-1',itemId:'item-1'}}});
  });

  it('rejects an equip replay after server-side ownership revocation', async () => {
    const { service: replay } = replayService({revokedAt:new Date('2026-09-23T06:00:00.000Z')});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an equip replay when the item is no longer available', async () => {
    const { service: replay } = replayService({revokedAt:null},{active:false});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an equip replay if persisted equipment crosses its authoritative slot', async () => {
    const { service: replay } = replayService({revokedAt:null},{slot:'AVATAR_FACE'});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).rejects.toBeInstanceOf(BadRequestException);
  });
});
