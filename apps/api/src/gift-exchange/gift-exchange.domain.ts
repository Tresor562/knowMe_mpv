export const GIFT_RARITIES = [
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
  'MYTHIC'
] as const;

export type GiftRarity = (typeof GIFT_RARITIES)[number];

export type GiftLifecycleState =
  | 'OWNED'
  | 'LISTED'
  | 'OFFER_LOCKED'
  | 'TRANSFER_LOCKED'
  | 'BURNED';

export type GiftDefinition = {
  key: string;
  name: string;
  basePriceKnowCoins: number;
  rarity: GiftRarity;
  limitedSupply: number | null;
  upgradeable: boolean;
  upgradeCostKnowCoins: number;
  transferable: boolean;
  resaleAllowed: boolean;
  craftable: boolean;
  premiumLaunchOnly: boolean;
  creatorRoyaltyBps: number;
  marketplaceFeeBps: number;
  active: boolean;
};

export type GiftTrait = {
  category: 'MODEL' | 'BACKDROP' | 'SYMBOL' | 'EFFECT' | 'SIGNATURE';
  key: string;
  rarityWeight: number;
};

export type GiftInstance = {
  id: string;
  definitionKey: string;
  ownerId: string;
  serialNumber: number;
  editionSize: number | null;
  collectible: boolean;
  traits: GiftTrait[];
  state: GiftLifecycleState;
  acquiredAt: Date;
  transferableAt: Date;
  listedAt: Date | null;
  lastSalePriceKnowCoins: number | null;
  provenanceHash: string;
};

export type GiftListing = {
  id: string;
  giftInstanceId: string;
  sellerId: string;
  priceKnowCoins: number;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
};

export type GiftMarketContext = {
  actorId: string;
  ownerId: string;
  now: Date;
  minimumPriceKnowCoins: number;
  maximumPriceKnowCoins: number;
  accountSuspended: boolean;
  marketplaceBlocked: boolean;
};

export type GiftSettlement = {
  buyerDebitKnowCoins: number;
  sellerCreditKnowCoins: number;
  treasuryFeeKnowCoins: number;
  creatorRoyaltyKnowCoins: number;
};

const MAX_FEE_BPS = 2_000;
const MAX_ROYALTY_BPS = 1_000;
const MIN_TRANSFER_COOLDOWN_MS = 60 * 60 * 1000;

const RARITY_VALUE_MULTIPLIER_BPS: Record<GiftRarity, number> = {
  COMMON: 10_000,
  UNCOMMON: 12_000,
  RARE: 16_000,
  EPIC: 24_000,
  LEGENDARY: 40_000,
  MYTHIC: 70_000
};

export function giftExchangePolicy() {
  return {
    schemaVersion: 1,
    giftsCanBeDisplayedOnProfile: true,
    collectionsSupported: true,
    upgradeToCollectibleSupported: true,
    deterministicTraitsRequired: true,
    transfersSupported: true,
    resaleMarketplaceSupported: true,
    directOffersSupported: true,
    auctionsPlanned: true,
    craftingPlanned: true,
    blockchainExportEnabledAtLaunch: false,
    KnowCoinsOnlyAtLaunch: true,
    serverAuthoritativeOwnership: true,
    serverAuthoritativePricingRules: true,
    idempotencyRequiredForMutations: true,
    serializableTransactionsRequired: true,
    selfPurchaseAllowed: false,
    washTradingDetectionRequired: true,
    antiFraudReviewRequiredForHighValueTrades: true,
    maximumMarketplaceFeeBps: MAX_FEE_BPS,
    maximumCreatorRoyaltyBps: MAX_ROYALTY_BPS,
    minimumTransferCooldownMs: MIN_TRANSFER_COOLDOWN_MS
  } as const;
}

export function validateGiftDefinition(definition: GiftDefinition): void {
  if (!definition.active) throw new Error('Cadeau inactif.');
  if (!Number.isInteger(definition.basePriceKnowCoins) || definition.basePriceKnowCoins < 0) {
    throw new Error('Prix de cadeau invalide.');
  }
  if (!Number.isInteger(definition.upgradeCostKnowCoins) || definition.upgradeCostKnowCoins < 0) {
    throw new Error('Coût d’amélioration invalide.');
  }
  if (
    !Number.isInteger(definition.marketplaceFeeBps) ||
    definition.marketplaceFeeBps < 0 ||
    definition.marketplaceFeeBps > MAX_FEE_BPS
  ) {
    throw new Error('Commission marketplace invalide.');
  }
  if (
    !Number.isInteger(definition.creatorRoyaltyBps) ||
    definition.creatorRoyaltyBps < 0 ||
    definition.creatorRoyaltyBps > MAX_ROYALTY_BPS
  ) {
    throw new Error('Royalty créateur invalide.');
  }
  if (definition.limitedSupply !== null && definition.limitedSupply <= 0) {
    throw new Error('Stock limité invalide.');
  }
}

export function calculateGiftResaleSettlement(
  priceKnowCoins: number,
  marketplaceFeeBps: number,
  creatorRoyaltyBps: number
): GiftSettlement {
  if (!Number.isInteger(priceKnowCoins) || priceKnowCoins <= 0) {
    throw new Error('Prix de revente invalide.');
  }
  if (
    !Number.isInteger(marketplaceFeeBps) ||
    marketplaceFeeBps < 0 ||
    marketplaceFeeBps > MAX_FEE_BPS
  ) {
    throw new Error('Commission marketplace invalide.');
  }
  if (
    !Number.isInteger(creatorRoyaltyBps) ||
    creatorRoyaltyBps < 0 ||
    creatorRoyaltyBps > MAX_ROYALTY_BPS
  ) {
    throw new Error('Royalty créateur invalide.');
  }

  const treasuryFeeKnowCoins = Math.floor((priceKnowCoins * marketplaceFeeBps) / 10_000);
  const creatorRoyaltyKnowCoins = Math.floor((priceKnowCoins * creatorRoyaltyBps) / 10_000);
  const sellerCreditKnowCoins =
    priceKnowCoins - treasuryFeeKnowCoins - creatorRoyaltyKnowCoins;

  if (sellerCreditKnowCoins <= 0) {
    throw new Error('Le vendeur doit recevoir un montant positif.');
  }

  return {
    buyerDebitKnowCoins: priceKnowCoins,
    sellerCreditKnowCoins,
    treasuryFeeKnowCoins,
    creatorRoyaltyKnowCoins
  };
}

export function assertGiftCanBeListed(
  instance: GiftInstance,
  listingPriceKnowCoins: number,
  definition: GiftDefinition,
  context: GiftMarketContext
): void {
  validateGiftDefinition(definition);
  if (!definition.resaleAllowed || !definition.transferable) {
    throw new Error('Ce cadeau ne peut pas être revendu.');
  }
  if (instance.ownerId !== context.ownerId || context.actorId !== context.ownerId) {
    throw new Error('Seul le propriétaire peut mettre ce cadeau en vente.');
  }
  if (context.accountSuspended || context.marketplaceBlocked) {
    throw new Error('Accès marketplace indisponible pour ce compte.');
  }
  if (instance.state !== 'OWNED') {
    throw new Error('Le cadeau doit être libre et possédé pour être listé.');
  }
  if (context.now.getTime() < instance.transferableAt.getTime()) {
    throw new Error('Le délai de transfert du cadeau n’est pas terminé.');
  }
  if (
    !Number.isInteger(listingPriceKnowCoins) ||
    listingPriceKnowCoins < context.minimumPriceKnowCoins ||
    listingPriceKnowCoins > context.maximumPriceKnowCoins
  ) {
    throw new Error('Prix de marketplace hors limites.');
  }
}

export function assertGiftPurchaseAllowed(
  listing: GiftListing,
  buyerId: string,
  sellerId: string,
  buyerBalanceKnowCoins: number,
  now: Date
): void {
  if (!listing.active) throw new Error('Annonce de cadeau inactive.');
  if (listing.sellerId !== sellerId) throw new Error('Vendeur incohérent.');
  if (buyerId === sellerId) throw new Error('Un vendeur ne peut pas acheter son propre cadeau.');
  if (listing.expiresAt && listing.expiresAt.getTime() <= now.getTime()) {
    throw new Error('Annonce de cadeau expirée.');
  }
  if (buyerBalanceKnowCoins < listing.priceKnowCoins) {
    throw new Error('Solde KnowCoins insuffisant.');
  }
}

export function calculateGiftUpgradePrice(definition: GiftDefinition): number {
  validateGiftDefinition(definition);
  if (!definition.upgradeable) throw new Error('Ce cadeau ne peut pas être amélioré.');
  return definition.upgradeCostKnowCoins;
}

export function calculateGiftEstimatedValue(
  definition: GiftDefinition,
  instance: GiftInstance,
  demandIndex: number
): number {
  validateGiftDefinition(definition);
  if (!Number.isFinite(demandIndex) || demandIndex < 0.5 || demandIndex > 3) {
    throw new Error('Indice de demande invalide.');
  }

  const rarityAdjusted = Math.round(
    (definition.basePriceKnowCoins * RARITY_VALUE_MULTIPLIER_BPS[definition.rarity]) /
      10_000
  );
  const collectibleMultiplier = instance.collectible ? 1.35 : 1;
  const lowSerialMultiplier = instance.serialNumber <= 100 ? 1.25 : 1;
  const traitPremium = instance.traits.reduce(
    (sum, trait) => sum + Math.max(0, 100 - trait.rarityWeight) * 4,
    0
  );
  const estimate =
    rarityAdjusted * collectibleMultiplier * lowSerialMultiplier * demandIndex +
    traitPremium;
  return Math.max(1, Math.round(estimate));
}

export function deriveTransferableAt(now: Date, cooldownMs = MIN_TRANSFER_COOLDOWN_MS): Date {
  if (!Number.isInteger(cooldownMs) || cooldownMs < MIN_TRANSFER_COOLDOWN_MS) {
    throw new Error('Délai de transfert insuffisant.');
  }
  return new Date(now.getTime() + cooldownMs);
}
