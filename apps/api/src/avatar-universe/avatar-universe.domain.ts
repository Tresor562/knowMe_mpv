export const AVATAR_PERSONALITIES = [
  'CALM',
  'CONFIDENT',
  'ELEGANT',
  'HEROIC',
  'MYSTERIOUS',
  'PLAYFUL',
  'REBELLIOUS',
  'FUTURISTIC'
] as const;

export type AvatarPersonality = (typeof AVATAR_PERSONALITIES)[number];

export const AVATAR_RENDER_TIERS = [
  'LAYERED_2D',
  'REALTIME_3D_BALANCED',
  'REALTIME_3D_HIGH',
  'CINEMATIC_PREVIEW'
] as const;
export type AvatarRenderTier = (typeof AVATAR_RENDER_TIERS)[number];

export const AVATAR_ESSENTIAL_SLOTS = ['AVATAR_SKIN','AVATAR_HAIR','AVATAR_FACE','AVATAR_OUTFIT','AVATAR_FOOTWEAR'] as const;
export const AVATAR_OPTIONAL_SLOTS = ['AVATAR_HEADWEAR','AVATAR_ACCESSORY','AVATAR_BACK_ITEM','AVATAR_HAND_ITEM','AVATAR_WEAPON_STYLE','AVATAR_AURA','AVATAR_COMPANION','AVATAR_FRAME'] as const;
export const AVATAR_ALL_SLOTS = [...AVATAR_ESSENTIAL_SLOTS, ...AVATAR_OPTIONAL_SLOTS] as const;
export type AvatarSlot = (typeof AVATAR_ALL_SLOTS)[number];

export type AvatarAcquisitionMode = 'FREE'|'KNOWCOINS'|'PREMIUM_KNOWCOINS'|'ACHIEVEMENT'|'EVENT'|'CREATOR_DROP';
export type AvatarItemRarity = 'COMMON'|'UNCOMMON'|'RARE'|'EPIC'|'LEGENDARY'|'MYTHIC';
export type AvatarThemeFamily = 'EVERYDAY'|'URBAN_FUTURE'|'NEON_RONIN'|'ARCANE_ACADEMY'|'COSMIC_GUARDIAN'|'SHADOW_OPERATIVE'|'ROYAL_STREET'|'MECHA_PILOT'|'CELESTIAL_WARRIOR'|'RETRO_ARCADE';

export type AvatarPersonalityProfile = {
  archetype: AvatarPersonality; confidence:number; expressiveness:number; energy:number; warmth:number; humor:number; mystery:number;
  idleAnimation:string; signaturePose:string; greetingStyle:string; emotePackKey:string;
};
export type AvatarMorphology = {
  height:number; shoulderWidth:number; torsoLength:number; muscleDefinition:number; bodyMass:number; headScale:number; jawWidth:number;
  cheekboneHeight:number; noseWidth:number; noseLength:number; eyeSize:number; eyeSpacing:number; browHeight:number; lipFullness:number; earSize:number;
};

export const AVATAR_DEFAULT_MORPHOLOGY: Readonly<AvatarMorphology> = Object.freeze({
  height:50, shoulderWidth:50, torsoLength:50, muscleDefinition:35, bodyMass:50, headScale:50, jawWidth:50, cheekboneHeight:50,
  noseWidth:50, noseLength:50, eyeSize:50, eyeSpacing:50, browHeight:50, lipFullness:50, earSize:50
});
export const AVATAR_DEFAULT_PERSONALITY: Readonly<AvatarPersonalityProfile> = Object.freeze({
  archetype:'CALM', confidence:50, expressiveness:50, energy:50, warmth:60, humor:50, mystery:35,
  idleAnimation:'idle-neutral-v1', signaturePose:'pose-neutral-v1', greetingStyle:'WAVE', emotePackKey:'emotes-core-v1'
});

export type AvatarItemDefinition = { key:string; name:string; slot:AvatarSlot; rarity:AvatarItemRarity; themeFamily:AvatarThemeFamily; acquisitionMode:AvatarAcquisitionMode; styleScore:number; craftsmanshipScore:number; animationComplexity:number; scarcityMultiplierBps:number; licensedReferenceId?:string|null; originalDesign:boolean; gameplayEffectsAllowed:false; active:boolean; };
export type AvatarPurchaseContext = { hasPremiumEntitlement:boolean; knowCoinBalance:number; };
export type ReadyAvatarBundle = { key:string; name:string; personality:AvatarPersonalityProfile; morphologyPresetKey:string; itemKeys:string[]; acquisitionMode:AvatarAcquisitionMode; bundleDiscountBps:number; };

const clampScore=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));
export function validateMorphology(m:AvatarMorphology){ for(const value of Object.values(m)){ if(!Number.isFinite(value)||value<0||value>100) throw new Error('Avatar morphology values must be between 0 and 100.'); } return m; }
export function calculateAvatarItemPrice(item:AvatarItemDefinition){ if(item.acquisitionMode==='FREE'||item.acquisitionMode==='ACHIEVEMENT'||item.acquisitionMode==='EVENT') return 0; const rarityBase={COMMON:40,UNCOMMON:70,RARE:120,EPIC:220,LEGENDARY:420,MYTHIC:750}[item.rarity]; const quality=clampScore(item.styleScore)+clampScore(item.craftsmanshipScore)+clampScore(item.animationComplexity); return Math.max(1,Math.round((rarityBase+quality)*Math.max(1000,item.scarcityMultiplierBps)/10000)); }
export function assertAvatarPurchaseAllowed(item:AvatarItemDefinition,ctx:AvatarPurchaseContext){ const price=calculateAvatarItemPrice(item); if(!item.active) throw new Error('Avatar item is inactive.'); if(item.acquisitionMode==='PREMIUM_KNOWCOINS'&&!ctx.hasPremiumEntitlement) throw new Error('Premium entitlement required.'); if(price>ctx.knowCoinBalance) throw new Error('Insufficient KnowCoins.'); return {priceKnowCoins:price}; }
export function calculateReadyAvatarBundlePrice(items:AvatarItemDefinition[],discountBps:number){ const subtotal=items.reduce((sum,item)=>sum+calculateAvatarItemPrice(item),0); const safe=Math.max(0,Math.min(5000,Math.round(discountBps))); return Math.max(0,Math.round(subtotal*(10000-safe)/10000)); }
export function hasCompleteFreeNormalAvatar(items:AvatarItemDefinition[]){ return AVATAR_ESSENTIAL_SLOTS.every(slot=>items.some(item=>item.slot===slot&&item.acquisitionMode==='FREE'&&item.active)); }
export const AVATAR_FREE_STARTER_KIT:AvatarItemDefinition[] = AVATAR_ESSENTIAL_SLOTS.map((slot,index)=>({key:`starter-${slot.toLowerCase()}`,name:`Starter ${slot}`,slot,rarity:'COMMON',themeFamily:'EVERYDAY',acquisitionMode:'FREE',styleScore:40+index,craftsmanshipScore:45,animationComplexity:10,scarcityMultiplierBps:10000,originalDesign:true,gameplayEffectsAllowed:false,active:true}));
export function avatarUniversePolicy(){ return {serverAuthoritative:true,visualOnly:true,gameplayEffectsAllowed:false,freeCompleteAvatarRequired:true,premiumKnowCoinsSupported:true,renderTiers:AVATAR_RENDER_TIERS,slots:AVATAR_ALL_SLOTS}; }
