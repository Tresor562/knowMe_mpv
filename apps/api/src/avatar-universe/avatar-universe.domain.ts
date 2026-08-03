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

export const AVATAR_ESSENTIAL_SLOTS = [
  'AVATAR_SKIN',
  'AVATAR_HAIR',
  'AVATAR_FACE',
  'AVATAR_OUTFIT',
  'AVATAR_FOOTWEAR'
] as const;

export const AVATAR_OPTIONAL_SLOTS = [
  'AVATAR_HEADWEAR',
  'AVATAR_ACCESSORY',
  'AVATAR_BACK_ITEM',
  'AVATAR_HAND_ITEM',
  'AVATAR_WEAPON_STYLE',
  'AVATAR_AURA',
  'AVATAR_COMPANION',
  'AVATAR_FRAME'
] as const;

export const AVATAR_ALL_SLOTS = [
  ...AVATAR_ESSENTIAL_SLOTS,
  ...AVATAR_OPTIONAL_SLOTS
] as const;

export type AvatarSlot = (typeof AVATAR_ALL_SLOTS)[number];

export type AvatarAcquisitionMode =
  | 'FREE'
  | 'KNOWCOINS'
  | 'PREMIUM_KNOWCOINS'
  | 'ACHIEVEMENT'
  | 'EVENT'
  | 'CREATOR_DROP';

export type AvatarItemRarity =
  | 'COMMON'
  | 'UNCOMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'MYTHIC';

export type AvatarThemeFamily =
  | 'EVERYDAY'
  | 'URBAN_FUTURE'
  | 'NEON_RONIN'
  | 'ARCANE_ACADEMY'
  | 'COSMIC_GUARDIAN'
  | 'SHADOW_OPERATIVE'
  | 'ROYAL_STREET'
  | 'MECHA_PILOT'
  | 'CELESTIAL_WARRIOR'
  | 'RETRO_ARCADE';

export type AvatarPersonalityProfile = {
  archetype: AvatarPersonality;
  confidence: number;
  expressiveness: number;
  energy: number;
  warmth: number;
  humor: number;
  mystery: number;
  idleAnimation: string;
  signaturePose: string;
  greetingStyle: string;
  emotePackKey: string;
};

export type AvatarMorphology = {
  height: number;
  shoulderWidth: number;
  torsoLength: number;
  muscleDefinition: number;
  bodyMass: number;
  headScale: number;
  jawWidth: number;
  cheekboneHeight: number;
  noseWidth: number;
  noseLength: number;
  eyeSize: number;
  eyeSpacing: number;
  browHeight: number;
  lipFullness: number;
  earSize: number;
};

export type AvatarItemDefinition = {
  key: string;
  name: string;
  slot: AvatarSlot;
  rarity: AvatarItemRarity;
  themeFamily: AvatarThemeFamily;
  acquisitionMode: AvatarAcquisitionMode;
  styleScore: number;
  craftsmanshipScore: number;
  animationComplexity: number;
  scarcityMultiplierBps: number;
  licensedReferenceId?: string | null;
  originalDesign: boolean;
  gameplayEffectsAllowed: false;
  active: boolean;
};

export type AvatarPurchaseContext = {
  hasPremiumEntitlement: boolean;
  knowCoinBalance: number;
};

export type ReadyAvatarBundle = {
  key: string;
  name: string;
  personality: AvatarPersonalityProfile;
  morphologyPresetKey: string;
  itemKeys: string[];
  acquisitionMode: AvatarAcquisitionMode;
  bundleDiscountBps: number;
};

const RARITY_BASE_PRICE: Record<AvatarItemRarity, number> = {
  COMMON: 80,
  UNCOMMON: 180,
  RARE: 450,
  EPIC: 1_100,
  LEGENDARY: 2_800,
  MYTHIC: 6_000
};

const MAX_ITEM_PRICE_KNOWCOINS = 50_000;
const MAX_BUNDLE_DISCOUNT_BPS = 2_500;

export const AVATAR_FREE_STARTER_KIT: AvatarItemDefinition[] = [
  {
    key: 'starter-skin-natural',
    name: 'Peau naturelle',
    slot: 'AVATAR_SKIN',
    rarity: 'COMMON',
    themeFamily: 'EVERYDAY',
    acquisitionMode: 'FREE',
    styleScore: 20,
    craftsmanshipScore: 30,
    animationComplexity: 0,
    scarcityMultiplierBps: 10_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true
  },
  {
    key: 'starter-hair-clean',
    name: 'Coiffure classique',
    slot: 'AVATAR_HAIR',
    rarity: 'COMMON',
    themeFamily: 'EVERYDAY',
    acquisitionMode: 'FREE',
    styleScore: 25,
    craftsmanshipScore: 30,
    animationComplexity: 0,
    scarcityMultiplierBps: 10_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true
  },
  {
    key: 'starter-face-natural',
    name: 'Visage naturel',
    slot: 'AVATAR_FACE',
    rarity: 'COMMON',
    themeFamily: 'EVERYDAY',
    acquisitionMode: 'FREE',
    styleScore: 20,
    craftsmanshipScore: 30,
    animationComplexity: 0,
    scarcityMultiplierBps: 10_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true
  },
  {
    key: 'starter-outfit-casual',
    name: 'Tenue quotidienne',
    slot: 'AVATAR_OUTFIT',
    rarity: 'COMMON',
    themeFamily: 'EVERYDAY',
    acquisitionMode: 'FREE',
    styleScore: 30,
    craftsmanshipScore: 35,
    animationComplexity: 0,
    scarcityMultiplierBps: 10_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true
  },
  {
    key: 'starter-footwear-clean',
    name: 'Baskets essentielles',
    slot: 'AVATAR_FOOTWEAR',
    rarity: 'COMMON',
    themeFamily: 'EVERYDAY',
    acquisitionMode: 'FREE',
    styleScore: 25,
    craftsmanshipScore: 30,
    animationComplexity: 0,
    scarcityMultiplierBps: 10_000,
    originalDesign: true,
    gameplayEffectsAllowed: false,
    active: true
  }
];

export function clampAvatarSlider(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Valeur morphologique invalide.');
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function validatePersonality(profile: AvatarPersonalityProfile): void {
  if (!AVATAR_PERSONALITIES.includes(profile.archetype)) {
    throw new Error('Personnalité d’avatar inconnue.');
  }
  for (const value of [
    profile.confidence,
    profile.expressiveness,
    profile.energy,
    profile.warmth,
    profile.humor,
    profile.mystery
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error('Les traits de personnalité doivent être compris entre 0 et 100.');
    }
  }
}

export function validateAvatarItem(item: AvatarItemDefinition): void {
  if (!item.active) throw new Error('Objet d’avatar inactif.');
  if (!item.originalDesign && !item.licensedReferenceId) {
    throw new Error('Une référence culturelle directe exige une licence explicite.');
  }
  if (item.gameplayEffectsAllowed !== false) {
    throw new Error('Les cosmétiques ne peuvent produire aucun avantage de gameplay.');
  }
  for (const score of [
    item.styleScore,
    item.craftsmanshipScore,
    item.animationComplexity
  ]) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new Error('Score cosmétique invalide.');
    }
  }
  if (
    !Number.isInteger(item.scarcityMultiplierBps) ||
    item.scarcityMultiplierBps < 10_000 ||
    item.scarcityMultiplierBps > 40_000
  ) {
    throw new Error('Multiplicateur de rareté invalide.');
  }
}

export function calculateAvatarItemPrice(item: AvatarItemDefinition): number {
  validateAvatarItem(item);
  if (item.acquisitionMode === 'FREE') return 0;

  const base = RARITY_BASE_PRICE[item.rarity];
  const styleValue = item.styleScore * 22;
  const craftsmanshipValue = item.craftsmanshipScore * 14;
  const animationValue = item.animationComplexity * 18;
  const premiumComplexity = item.acquisitionMode === 'PREMIUM_KNOWCOINS' ? 250 : 0;
  const raw = base + styleValue + craftsmanshipValue + animationValue + premiumComplexity;
  const scarcityAdjusted = Math.round((raw * item.scarcityMultiplierBps) / 10_000);
  const capped = Math.min(MAX_ITEM_PRICE_KNOWCOINS, scarcityAdjusted);
  return Math.max(10, Math.round(capped / 10) * 10);
}

export function assertAvatarPurchaseAllowed(
  item: AvatarItemDefinition,
  context: AvatarPurchaseContext
): number {
  const price = calculateAvatarItemPrice(item);
  if (
    item.acquisitionMode === 'ACHIEVEMENT' ||
    item.acquisitionMode === 'EVENT' ||
    item.acquisitionMode === 'CREATOR_DROP'
  ) {
    throw new Error('Cet objet ne peut pas être acheté directement.');
  }
  if (
    item.acquisitionMode === 'PREMIUM_KNOWCOINS' &&
    !context.hasPremiumEntitlement
  ) {
    throw new Error('Cet objet exige Premium puis un paiement en KnowCoins.');
  }
  if (context.knowCoinBalance < price) {
    throw new Error('Solde KnowCoins insuffisant.');
  }
  return price;
}

export function calculateReadyAvatarBundlePrice(
  items: AvatarItemDefinition[],
  discountBps: number
): number {
  if (!Number.isInteger(discountBps) || discountBps < 0) {
    throw new Error('Remise de bundle invalide.');
  }
  const safeDiscount = Math.min(discountBps, MAX_BUNDLE_DISCOUNT_BPS);
  const subtotal = items.reduce((sum, item) => sum + calculateAvatarItemPrice(item), 0);
  return Math.round((subtotal * (10_000 - safeDiscount)) / 10_000 / 10) * 10;
}

export function hasCompleteFreeNormalAvatar(items: AvatarItemDefinition[]): boolean {
  const freeActiveSlots = new Set(
    items
      .filter((item) => item.active && item.acquisitionMode === 'FREE')
      .map((item) => item.slot)
  );
  return AVATAR_ESSENTIAL_SLOTS.every((slot) => freeActiveSlots.has(slot));
}

export function avatarRenderPolicy() {
  return {
    defaultTier: 'REALTIME_3D_BALANCED' as AvatarRenderTier,
    lowPowerFallback: 'LAYERED_2D' as AvatarRenderTier,
    highEndTier: 'REALTIME_3D_HIGH' as AvatarRenderTier,
    cinematicPreviewTier: 'CINEMATIC_PREVIEW' as AvatarRenderTier,
    targetFramesPerSecond: {
      lowPower: 30,
      balanced: 45,
      highEnd: 60
    },
    physicallyBasedMaterials: true,
    skeletalAnimation: true,
    facialBlendShapes: true,
    clothSimulationByDeviceTier: true,
    levelOfDetailRequired: true,
    photorealisticAAAGuarantee: false,
    visualOnly: true,
    gameplayEffectsAllowed: false
  } as const;
}

export function avatarUniversePolicy() {
  return {
    schemaVersion: 1,
    serverAuthoritativePricing: true,
    serverAuthoritativeOwnership: true,
    premiumFlagsTrustedFromClient: false,
    premiumItemsStillRequireKnowCoins: true,
    freeCompleteAvatarRequired: true,
    directFranchiseCopiesAllowed: false,
    licensedCollaborationsAllowed: true,
    fictionalStylizedWeaponsAllowed: true,
    realWeaponPerformanceSimulationAllowed: false,
    visualOnly: true,
    resalePlannedThroughMarketplace: true,
    maximumBundleDiscountBps: MAX_BUNDLE_DISCOUNT_BPS,
    maximumItemPriceKnowCoins: MAX_ITEM_PRICE_KNOWCOINS,
    render: avatarRenderPolicy()
  } as const;
}
