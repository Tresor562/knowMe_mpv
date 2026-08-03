export type StickerDefinition = {
  key: string;
  version: number;
  name: string;
  emoji: string;
  altText: string;
  assetToken: string;
  active: boolean;
};

export type StickerPackDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  coverEmoji: string;
  free: true;
  active: boolean;
  stickers: readonly StickerDefinition[];
};

export const STICKER_PACKS: readonly StickerPackDefinition[] = [
  {
    key: 'knowme-sparks',
    version: 1,
    name: 'KnowMe Sparks',
    description: 'Réactions lumineuses pour célébrer les petits moments entre amis.',
    coverEmoji: '✨',
    free: true,
    active: true,
    stickers: [
      { key: 'bright-hello', version: 1, name: 'Salut lumineux', emoji: '👋✨', altText: 'Une main qui salue avec des étincelles', assetToken: 'sticker.sparks.bright-hello.v1', active: true },
      { key: 'tiny-win', version: 1, name: 'Petite victoire', emoji: '🏆✨', altText: 'Un petit trophée entouré d’étincelles', assetToken: 'sticker.sparks.tiny-win.v1', active: true },
      { key: 'brain-flash', version: 1, name: 'Éclair de génie', emoji: '🧠⚡', altText: 'Un cerveau traversé par un éclair', assetToken: 'sticker.sparks.brain-flash.v1', active: true },
      { key: 'calm-glow', version: 1, name: 'Lueur calme', emoji: '🌙💫', altText: 'Une lune calme avec une lueur douce', assetToken: 'sticker.sparks.calm-glow.v1', active: true },
      { key: 'you-got-this', version: 1, name: 'Tu peux le faire', emoji: '💪🌟', altText: 'Un bras fort accompagné d’une étoile', assetToken: 'sticker.sparks.you-got-this.v1', active: true },
      { key: 'good-vibes', version: 1, name: 'Bonnes ondes', emoji: '〰️💚', altText: 'Des ondes positives vertes', assetToken: 'sticker.sparks.good-vibes.v1', active: true },
      { key: 'idea-orbit', version: 1, name: 'Idée en orbite', emoji: '💡🪐', altText: 'Une ampoule en orbite autour d’une planète', assetToken: 'sticker.sparks.idea-orbit.v1', active: true },
      { key: 'mission-done', version: 1, name: 'Mission accomplie', emoji: '✅🚀', altText: 'Une validation accompagnée d’une fusée', assetToken: 'sticker.sparks.mission-done.v1', active: true }
    ]
  },
  {
    key: 'friendship-orbit',
    version: 1,
    name: 'Friendship Orbit',
    description: 'Gestes chaleureux et originaux pour les conversations proches.',
    coverEmoji: '🪐',
    free: true,
    active: true,
    stickers: [
      { key: 'orbit-hug', version: 1, name: 'Câlin orbital', emoji: '🫂🪐', altText: 'Deux personnes qui se prennent dans les bras près d’une planète', assetToken: 'sticker.orbit.orbit-hug.v1', active: true },
      { key: 'high-five-comet', version: 1, name: 'High five comète', emoji: '🙌☄️', altText: 'Un high five traversé par une comète', assetToken: 'sticker.orbit.high-five-comet.v1', active: true },
      { key: 'tea-break', version: 1, name: 'Pause ensemble', emoji: '🫖🌌', altText: 'Une théière devant un ciel étoilé', assetToken: 'sticker.orbit.tea-break.v1', active: true },
      { key: 'listening-star', version: 1, name: 'Je t’écoute', emoji: '👂⭐', altText: 'Une oreille attentive accompagnée d’une étoile', assetToken: 'sticker.orbit.listening-star.v1', active: true },
      { key: 'safe-space', version: 1, name: 'Espace sûr', emoji: '🛡️💚', altText: 'Un bouclier vert symbolisant un espace sûr', assetToken: 'sticker.orbit.safe-space.v1', active: true },
      { key: 'shared-laugh', version: 1, name: 'Rire partagé', emoji: '😂🌠', altText: 'Un rire traversé par une étoile filante', assetToken: 'sticker.orbit.shared-laugh.v1', active: true },
      { key: 'thinking-of-you', version: 1, name: 'Je pense à toi', emoji: '💭🌙', altText: 'Une pensée douce sous la lune', assetToken: 'sticker.orbit.thinking-of-you.v1', active: true },
      { key: 'big-dipper-bond', version: 1, name: 'Lien Grande Ourse', emoji: '🌌🤝', altText: 'Une poignée de main sous la Grande Ourse', assetToken: 'sticker.orbit.big-dipper-bond.v1', active: true }
    ]
  }
] as const;

export function activeStickerPacks() {
  return STICKER_PACKS.filter((pack) => pack.active).map((pack) => ({
    ...pack,
    stickers: pack.stickers.filter((sticker) => sticker.active)
  }));
}

export function stickerByKey(packKey: string, stickerKey: string) {
  const pack = STICKER_PACKS.find(
    (entry) => entry.active && entry.key === packKey.trim().toLowerCase()
  );
  const sticker = pack?.stickers.find(
    (entry) => entry.active && entry.key === stickerKey.trim().toLowerCase()
  );
  return pack && sticker ? { pack, sticker } : null;
}
