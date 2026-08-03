export type KnowMeSticker = {
  key: string;
  version: number;
  label: string;
  glyph: string;
  accessibilityLabel: string;
};

export type KnowMeStickerPack = {
  key: string;
  version: number;
  name: string;
  description: string;
  stickers: readonly KnowMeSticker[];
};

const PACKS = [
  {
    key: 'knowme-sparks',
    version: 1,
    name: 'KnowMe Sparks',
    description: 'Réactions positives et expressives créées pour KnowMe.',
    stickers: [
      { key: 'bravo', version: 1, label: 'Bravo', glyph: '👏✨', accessibilityLabel: 'Applaudissements brillants' },
      { key: 'coeur', version: 1, label: 'Cœur', glyph: '💚🌟', accessibilityLabel: 'Cœur vert avec étoile' },
      { key: 'incroyable', version: 1, label: 'Incroyable', glyph: '🤯⚡', accessibilityLabel: 'Visage étonné avec éclair' },
      { key: 'ensemble', version: 1, label: 'Ensemble', glyph: '🤝💫', accessibilityLabel: 'Poignée de main lumineuse' },
      { key: 'merci', version: 1, label: 'Merci', glyph: '🙏🌈', accessibilityLabel: 'Merci avec arc-en-ciel' },
      { key: 'victoire', version: 1, label: 'Victoire', glyph: '🏆🔥', accessibilityLabel: 'Trophée enflammé' }
    ]
  },
  {
    key: 'nexus-moods',
    version: 1,
    name: 'Nexus Moods',
    description: 'Humeurs originales de la communauté Nexus Tech.',
    stickers: [
      { key: 'focus', version: 1, label: 'Focus', glyph: '🧠🎯', accessibilityLabel: 'Cerveau concentré sur une cible' },
      { key: 'code', version: 1, label: 'Code', glyph: '💻⚙️', accessibilityLabel: 'Ordinateur et engrenage' },
      { key: 'idee', version: 1, label: 'Idée', glyph: '💡🚀', accessibilityLabel: 'Idée qui décolle' },
      { key: 'securise', version: 1, label: 'Sécurisé', glyph: '🛡️✅', accessibilityLabel: 'Bouclier validé' },
      { key: 'bug', version: 1, label: 'Bug trouvé', glyph: '🐞🔎', accessibilityLabel: 'Bug sous une loupe' },
      { key: 'nuit', version: 1, label: 'Mode nuit', glyph: '🌙⌨️', accessibilityLabel: 'Clavier sous la lune' }
    ]
  }
] as const satisfies readonly KnowMeStickerPack[];

export function stickerCatalog() {
  return PACKS.map((pack) => ({
    key: pack.key,
    version: pack.version,
    name: pack.name,
    description: pack.description,
    stickers: pack.stickers.map((sticker) => ({ ...sticker }))
  }));
}

export function findSticker(packKey: string, stickerKey: string) {
  const pack = PACKS.find((candidate) => candidate.key === packKey);
  const sticker = pack?.stickers.find((candidate) => candidate.key === stickerKey);
  return pack && sticker ? { pack, sticker } : null;
}

export function stickerCatalogInvariantErrors() {
  const errors: string[] = [];
  const packKeys = new Set<string>();

  for (const pack of PACKS) {
    if (!/^[a-z0-9-]{3,48}$/.test(pack.key)) errors.push(`PACK_KEY:${pack.key}`);
    if (packKeys.has(pack.key)) errors.push(`PACK_DUPLICATE:${pack.key}`);
    packKeys.add(pack.key);
    if (!Number.isInteger(pack.version) || pack.version < 1) errors.push(`PACK_VERSION:${pack.key}`);
    if (pack.stickers.length < 1 || pack.stickers.length > 50) errors.push(`PACK_SIZE:${pack.key}`);

    const stickerKeys = new Set<string>();
    for (const sticker of pack.stickers) {
      if (!/^[a-z0-9-]{2,48}$/.test(sticker.key)) errors.push(`STICKER_KEY:${pack.key}:${sticker.key}`);
      if (stickerKeys.has(sticker.key)) errors.push(`STICKER_DUPLICATE:${pack.key}:${sticker.key}`);
      stickerKeys.add(sticker.key);
      if (!Number.isInteger(sticker.version) || sticker.version < 1) errors.push(`STICKER_VERSION:${pack.key}:${sticker.key}`);
      if (!sticker.glyph || sticker.glyph.length > 32) errors.push(`STICKER_GLYPH:${pack.key}:${sticker.key}`);
      if (!sticker.accessibilityLabel.trim()) errors.push(`STICKER_A11Y:${pack.key}:${sticker.key}`);
    }
  }

  return errors;
}
