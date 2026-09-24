import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AVATAR_ALL_SLOTS } from '../avatar-universe/avatar-universe.domain';
import { COSMETIC_RARITIES, COSMETIC_SLOTS } from './dto/cosmetics.dto';
import { CosmeticsService } from './cosmetics.service';

const hairManifest = {
  manifestVersion:1, assetKey:'knowme.hair.equip-spec.v1', kind:'HAIR', slot:'AVATAR_HAIR', format:'GLB', materialProfileKey:'knowme.hair.pbr.v1', morphTargets:[],
  lods:[
    {level:0,uri:'asset://runtime/avatar/hair/equip-lod0.glb',triangles:24000,vertices:13000,downloadBytes:2_000_000},
    {level:1,uri:'asset://runtime/avatar/hair/equip-lod1.glb',triangles:15000,vertices:8000,downloadBytes:1_200_000},
    {level:2,uri:'asset://runtime/avatar/hair/equip-lod2.glb',triangles:7000,vertices:3500,downloadBytes:600_000}
  ],
  textures:{baseColor:'asset://runtime/avatar/textures/equip-hair-base.ktx2',normal:'asset://runtime/avatar/textures/equip-hair-normal.ktx2',maxResolution:2048},
  geometry:{skinned:false,hairCards:true}, pbr:true, originalDesign:true
};

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
    const item = { id:'item-1', slot:'AVATAR_HAIR', active:true, startsAt:new Date('2026-01-01T00:00:00.000Z'), endsAt:null, assetUrl:hairManifest.lods[0].uri, avatarAssetManifest:hairManifest, assetValidatedAt:new Date('2026-09-23T00:00:00.000Z'), ...itemOverrides };
    const prisma = {
      cosmeticEquipment:{ findUnique:jest.fn().mockResolvedValue({id:'equipment-1',userId:'user-1',slot:'AVATAR_HAIR',itemId:'item-1',item}) },
      cosmeticOwnership:{ findUnique:jest.fn().mockResolvedValue(ownership) }
    };
    return { service:new CosmeticsService(prisma as never, {record:jest.fn()} as never), prisma };
  }

  function meService(options: { owned?: boolean; itemOverrides?: Record<string, unknown>; equipmentSlot?: string } = {}) {
    const item={ id:'item-1', slot:'AVATAR_HAIR', active:true, startsAt:new Date('2026-01-01T00:00:00.000Z'), endsAt:null, assetUrl:hairManifest.lods[0].uri, avatarAssetManifest:hairManifest, assetValidatedAt:new Date('2026-09-23T00:00:00.000Z'), ...(options.itemOverrides??{}) };
    const ownership={id:'ownership-1',userId:'user-1',itemId:'item-1',revokedAt:null,acquiredAt:new Date('2026-09-23T00:00:00.000Z'),item};
    const equipment={id:'equipment-1',userId:'user-1',slot:options.equipmentSlot??'AVATAR_HAIR',itemId:'item-1',item};
    const prisma={cosmeticOwnership:{findMany:jest.fn().mockResolvedValue(options.owned===false?[]:[ownership])},cosmeticEquipment:{findMany:jest.fn().mockResolvedValue([equipment])}};
    return new CosmeticsService(prisma as never,{} as never);
  }

  it('revalidates ownership and the complete persisted runtime manifest before accepting an idempotent equip replay', async () => {
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

  it('rejects an equip replay when the persisted runtime manifest was tampered after certification', async () => {
    const tampered={...hairManifest,geometry:{...hairManifest.geometry,hairCards:false}};
    const { service: replay }=replayService({revokedAt:null},{avatarAssetManifest:tampered});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an equip replay when assetUrl no longer points at the certified LOD0', async () => {
    const { service: replay }=replayService({revokedAt:null},{assetUrl:'https://evil.invalid/replaced.glb'});
    await expect(replay.equip('user-1','AVATAR_HAIR',{itemId:'item-1'})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only exposes equipped avatar assets that still have active ownership and a valid certified runtime manifest', async()=>{
    const result=await meService().me('user-1');
    expect(result.equipment).toHaveLength(1);
    expect(result.inventory[0]).toEqual(expect.objectContaining({equipped:true}));
  });

  it('fails closed on the read path when persisted equipment points at a tampered runtime manifest', async()=>{
    const tampered={...hairManifest,geometry:{...hairManifest.geometry,hairCards:false}};
    const result=await meService({itemOverrides:{avatarAssetManifest:tampered}}).me('user-1');
    expect(result.equipment).toEqual([]);
    expect(result.inventory[0]).toEqual(expect.objectContaining({equipped:false}));
  });

  it('does not expose stale equipment when server-side ownership is absent', async()=>{
    const result=await meService({owned:false}).me('user-1');
    expect(result.equipment).toEqual([]);
  });

  it('does not expose persisted equipment that crosses its authoritative slot', async()=>{
    const result=await meService({equipmentSlot:'AVATAR_FACE'}).me('user-1');
    expect(result.equipment).toEqual([]);
    expect(result.inventory[0]).toEqual(expect.objectContaining({equipped:false}));
  });
});
