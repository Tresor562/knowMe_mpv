export type SocialGiftRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC';

export type SocialGiftDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  emoji: string;
  priceKnowCoins: number;
  rarity: SocialGiftRarity;
  animationToken: string;
  active: boolean;
};

export const SOCIAL_GIFT_CATALOG: readonly SocialGiftDefinition[] = [
  {
    key: 'spark',
    version: 1,
    name: 'Étincelle',
    description: 'Une petite étincelle pour illuminer la journée d’un ami.',
    emoji: '✨',
    priceKnowCoins: 25,
    rarity: 'COMMON',
    animationToken: 'gift.spark.v1',
    active: true
  },
  {
    key: 'high-five',
    version: 1,
    name: 'High Five',
    description: 'Un geste simple pour célébrer une réussite ensemble.',
    emoji: '🙌',
    priceKnowCoins: 40,
    rarity: 'COMMON',
    animationToken: 'gift.high-five.v1',
    active: true
  },
  {
    key: 'warm-cup',
    version: 1,
    name: 'Tasse chaleureuse',
    description: 'Une pause virtuelle offerte avec bienveillance.',
    emoji: '☕',
    priceKnowCoins: 60,
    rarity: 'COMMON',
    animationToken: 'gift.warm-cup.v1',
    active: true
  },
  {
    key: 'lucky-clover',
    version: 1,
    name: 'Trèfle chanceux',
    description: 'Un souhait de chance pour le prochain défi.',
    emoji: '🍀',
    priceKnowCoins: 90,
    rarity: 'UNCOMMON',
    animationToken: 'gift.lucky-clover.v1',
    active: true
  },
  {
    key: 'friendship-bloom',
    version: 1,
    name: 'Fleur d’amitié',
    description: 'Une fleur virtuelle qui symbolise une relation positive.',
    emoji: '🌼',
    priceKnowCoins: 120,
    rarity: 'UNCOMMON',
    animationToken: 'gift.friendship-bloom.v1',
    active: true
  },
  {
    key: 'orbit-star',
    version: 1,
    name: 'Étoile en orbite',
    description: 'Une étoile originale pour remercier une personne importante.',
    emoji: '🌟',
    priceKnowCoins: 180,
    rarity: 'UNCOMMON',
    animationToken: 'gift.orbit-star.v1',
    active: true
  },
  {
    key: 'aurora-heart',
    version: 1,
    name: 'Cœur boréal',
    description: 'Une lueur douce pour exprimer une affection amicale.',
    emoji: '💚',
    priceKnowCoins: 260,
    rarity: 'RARE',
    animationToken: 'gift.aurora-heart.v1',
    active: true
  },
  {
    key: 'moon-lantern',
    version: 1,
    name: 'Lanterne lunaire',
    description: 'Une lanterne virtuelle pour accompagner les moments calmes.',
    emoji: '🏮',
    priceKnowCoins: 360,
    rarity: 'RARE',
    animationToken: 'gift.moon-lantern.v1',
    active: true
  },
  {
    key: 'comet-badge',
    version: 1,
    name: 'Comète souvenir',
    description: 'Un souvenir visuel rare qui traverse le profil comme une comète.',
    emoji: '☄️',
    priceKnowCoins: 520,
    rarity: 'RARE',
    animationToken: 'gift.comet-badge.v1',
    active: true
  },
  {
    key: 'nebula-bloom',
    version: 1,
    name: 'Floraison nébuleuse',
    description: 'Une composition cosmique réservée aux grandes attentions.',
    emoji: '🌌',
    priceKnowCoins: 800,
    rarity: 'EPIC',
    animationToken: 'gift.nebula-bloom.v1',
    active: true
  },
  {
    key: 'constellation',
    version: 1,
    name: 'Constellation liée',
    description: 'Deux trajectoires reliées dans une animation purement visuelle.',
    emoji: '🪐',
    priceKnowCoins: 1200,
    rarity: 'EPIC',
    animationToken: 'gift.constellation.v1',
    active: true
  },
  {
    key: 'big-dipper',
    version: 1,
    name: 'Grande Ourse',
    description: 'Le cadeau signature KnowMe pour une amitié exceptionnelle.',
    emoji: '🌠',
    priceKnowCoins: 1800,
    rarity: 'EPIC',
    animationToken: 'gift.big-dipper.v1',
    active: true
  }
] as const;

export function socialGiftByKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return SOCIAL_GIFT_CATALOG.find((gift) => gift.key === normalized && gift.active);
}

export function publicSocialGift(gift: SocialGiftDefinition) {
  return {
    ...gift,
    visualOnly: true as const,
    redeemable: false as const,
    transferable: false as const,
    resaleAllowed: false as const,
    gameplayEffectsAllowed: false as const
  };
}
