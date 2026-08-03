export type ThemeTier = 'FREE' | 'PREMIUM';
export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
export type ThemeCategory =
  | 'ESSENTIAL'
  | 'NATURE'
  | 'WEATHER'
  | 'SEASON'
  | 'UNIVERSE'
  | 'FUTURISTIC'
  | 'ANIME'
  | 'GAMING'
  | 'FANTASY'
  | 'ARTISTIC';
export type EffectIntensity = 'LOW' | 'BALANCED' | 'HIGH';

export type ThemePalette = {
  background: string;
  backgroundAccent: string;
  surface: string;
  surfaceRaised: string;
  surfaceGlass: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  border: string;
  danger: string;
  onAccent: string;
  statusBar: 'light' | 'dark' | 'adaptive';
};

export type IconPackDefinition = {
  key: string;
  name: string;
  tier: ThemeTier;
  animated: boolean;
  description: string;
  entitlementKeys: readonly string[];
};

export type AppIconDefinition = {
  key: string;
  name: string;
  tier: ThemeTier;
  seasonal: boolean;
  entitlementKeys: readonly string[];
};

export type ThemeDefinition = {
  order: number;
  key: string;
  name: string;
  category: ThemeCategory;
  mode: ThemeMode;
  tier: ThemeTier;
  premium: boolean;
  description: string;
  palette: ThemePalette;
  iconPackKey: string;
  effects: readonly string[];
  animationPreset: string;
  soundPreset: string;
  chatBubbleStyle: string;
  cardStyle: string;
  transitionPreset: string;
  appIconKey: string | null;
  entitlementKeys: readonly string[];
  capabilities: {
    background: true;
    palette: true;
    icons: true;
    chatBubbles: true;
    controls: true;
    cards: true;
    menus: true;
    transitions: true;
    openingAnimation: boolean;
    uiSounds: boolean;
    messageEffects: boolean;
    notificationEffects: boolean;
    profileFrames: true;
    badges: true;
    reactions: true;
    progress: true;
    loaders: true;
    knowCoins: true;
    challenges: true;
    leaderboards: true;
    rewardChests: true;
    homeWidgets: true;
    alternateAppIcon: boolean;
  };
};

const THEME_NAMES = [
  ['system', 'Classique KnowMe'],
  ['light-minimal', 'Clair Minimal'],
  ['dark-elegant', 'Sombre Élégant'],
  ['blue-ocean', 'Bleu Océan'],
  ['rose-sakura', 'Rose Sakura'],
  ['green-nature', 'Vert Nature'],
  ['violet-galaxy', 'Violet Galaxy'],
  ['orange-sunset', 'Orange Sunset'],
  ['red-passion', 'Rouge Passion'],
  ['cyan-crystal', 'Cyan Crystal'],
  ['white-glass', 'Blanc Glass'],
  ['black-carbon', 'Noir Carbone'],
  ['sky-blue', 'Ciel Bleu'],
  ['lavender', 'Lavande'],
  ['fresh-mint', 'Menthe Fraîche'],
  ['coffee', 'Café'],
  ['chocolate', 'Chocolat'],
  ['sand', 'Sable'],
  ['forest', 'Forêt'],
  ['tropical', 'Tropical'],
  ['autumn', 'Automne'],
  ['spring', 'Printemps'],
  ['summer', 'Été'],
  ['winter', 'Hiver'],
  ['rain', 'Pluie'],
  ['snow', 'Neige'],
  ['stars', 'Étoiles'],
  ['aurora', 'Aurores Boréales'],
  ['rainbow', 'Arc-en-ciel'],
  ['pixel', 'Pixel'],
  ['paper', 'Papier'],
  ['notebook', 'Carnet'],
  ['book', 'Livre'],
  ['vintage', 'Vintage'],
  ['retro', 'Rétro'],
  ['simple-neon', 'Néon Simple'],
  ['soft-pastel', 'Soft Pastel'],
  ['aqua', 'Aqua'],
  ['minimal-glass', 'Minimal Glass'],
  ['animated-classic', 'Classique Animé'],
  ['galaxy-ultra', 'Galaxy Ultra'],
  ['milky-way', 'Voie Lactée'],
  ['black-hole', 'Trou Noir'],
  ['cosmic-universe', 'Univers Cosmique'],
  ['planets', 'Planètes'],
  ['nebulae', 'Nébuleuses'],
  ['space-station', 'Station Spatiale'],
  ['cyber-galaxy', 'Cyber Galaxy'],
  ['shooting-stars', 'Étoiles Filantes'],
  ['constellations', 'Constellations'],
  ['cyberpunk', 'Cyberpunk'],
  ['matrix', 'Matrix'],
  ['future-ai', 'IA Futuriste'],
  ['hologram', 'Hologramme'],
  ['chrome-metal', 'Métal Chromé'],
  ['digital-world', 'Digital World'],
  ['quantum', 'Quantum'],
  ['neon-city', 'Neon City'],
  ['robotics', 'Robotique'],
  ['tech-blue', 'Tech Blue'],
  ['sakura-dream', 'Sakura Dream'],
  ['kawaii', 'Kawaii'],
  ['shonen', 'Shōnen'],
  ['shojo', 'Shōjo'],
  ['isekai', 'Isekai'],
  ['fantasy-anime', 'Fantasy Anime'],
  ['ninja', 'Ninja'],
  ['samurai', 'Samouraï'],
  ['yokai', 'Yokai'],
  ['spirit-world', 'Spirit World'],
  ['rpg-fantasy', 'RPG Fantasy'],
  ['mmorpg', 'MMORPG'],
  ['pixel-deluxe', 'Pixel Deluxe'],
  ['dungeon', 'Dungeon'],
  ['boss-battle', 'Boss Battle'],
  ['arcade', 'Arcade'],
  ['battle-royale', 'Battle Royale'],
  ['speed-run', 'Speed Run'],
  ['esport', 'Esport'],
  ['loot-box', 'Loot Box'],
  ['magic-kingdom', 'Royaume Magique'],
  ['dragon', 'Dragon'],
  ['wizard', 'Magicien'],
  ['elves', 'Elfes'],
  ['castle', 'Château'],
  ['pirate', 'Pirate'],
  ['viking', 'Viking'],
  ['mythology', 'Mythologie'],
  ['celestial-kingdom', 'Royaume Céleste'],
  ['underworld', 'Enfers'],
  ['watercolor', 'Aquarelle'],
  ['oil-painting', "Peinture à l'huile"],
  ['origami', 'Origami'],
  ['calligraphy', 'Calligraphie'],
  ['graffiti', 'Graffiti'],
  ['crystal', 'Cristal'],
  ['marble', 'Marbre'],
  ['diamond', 'Diamant'],
  ['royal-gold', 'Or Royal'],
  ['knowme-prestige', 'Prestige KnowMe']
] as const;

const FREE_ICON_PACK_NAMES = ['Rounded', 'Filled', 'Outline', 'Soft Glass', 'Material Plus'] as const;
const PREMIUM_ICON_PACK_NAMES = [
  'Crystal', 'Neon', 'Cyber', 'Anime', 'Pixel', 'Fantasy', 'Gold', 'Diamond', 'Cosmic',
  'Liquid', 'Glass Ultra', 'Matte Black', 'White Pearl', 'Chrome', 'Gradient Dynamic',
  'RGB Gaming', 'Holographic', 'Frost', 'Fire', 'Lightning'
] as const;

const slug = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export const ICON_PACKS: readonly IconPackDefinition[] = [
  ...FREE_ICON_PACK_NAMES.map((name) => ({
    key: slug(name),
    name,
    tier: 'FREE' as const,
    animated: false,
    description: `${name} conserve une lecture immédiate sur tous les écrans.`,
    entitlementKeys: [] as readonly string[]
  })),
  ...PREMIUM_ICON_PACK_NAMES.map((name) => ({
    key: slug(name),
    name,
    tier: 'PREMIUM' as const,
    animated: !['Matte Black'].includes(name),
    description: `${name} ajoute une identité visuelle Premium avec effets contrôlés.`,
    entitlementKeys: [`icon-pack.${slug(name)}`, 'subscription.premium'] as readonly string[]
  }))
];

const FREE_APP_ICONS = ['Classique KnowMe', 'Clair', 'Sombre', 'Bleu', 'Rose'] as const;
const PREMIUM_APP_ICONS = [
  'Galaxy', 'Cyberpunk', 'Sakura', 'Anime', 'Gaming RGB', 'Gold', 'Diamond', 'Glass Ultra',
  'Neon', 'Halloween', 'Noël', 'Été', 'Hiver', 'Prestige', 'Édition limitée'
] as const;

export const APP_ICONS: readonly AppIconDefinition[] = [
  ...FREE_APP_ICONS.map((name) => ({
    key: slug(name),
    name,
    tier: 'FREE' as const,
    seasonal: false,
    entitlementKeys: [] as readonly string[]
  })),
  ...PREMIUM_APP_ICONS.map((name) => ({
    key: slug(name),
    name,
    tier: 'PREMIUM' as const,
    seasonal: ['Halloween', 'Noël', 'Été', 'Hiver', 'Édition limitée'].includes(name),
    entitlementKeys: [`app-icon.${slug(name)}`, 'subscription.premium'] as readonly string[]
  }))
];

const isMatch = (value: string, pattern: RegExp) => pattern.test(value);

function categoryFor(order: number, key: string): ThemeCategory {
  if (order >= 41 && order <= 50) return 'UNIVERSE';
  if (order <= 60 && order >= 51) return 'FUTURISTIC';
  if (order <= 70 && order >= 61) return 'ANIME';
  if (order <= 80 && order >= 71) return 'GAMING';
  if (order <= 90 && order >= 81) return 'FANTASY';
  if (order >= 91) return 'ARTISTIC';
  if (isMatch(key, /rain|snow/)) return 'WEATHER';
  if (isMatch(key, /autumn|spring|summer|winter/)) return 'SEASON';
  if (isMatch(key, /galaxy|stars|aurora/)) return 'UNIVERSE';
  if (isMatch(key, /pixel|retro/)) return 'GAMING';
  if (isMatch(key, /paper|notebook|book|vintage|pastel|rainbow|coffee|chocolate/)) return 'ARTISTIC';
  if (isMatch(key, /ocean|sakura|nature|sunset|sky|lavender|mint|sand|forest|tropical|aqua/)) return 'NATURE';
  if (isMatch(key, /neon/)) return 'FUTURISTIC';
  return 'ESSENTIAL';
}

function modeFor(key: string): ThemeMode {
  if (isMatch(key, /^(system|minimal-glass|animated-classic)$/)) return 'SYSTEM';
  if (isMatch(key, /light|white|sky|lavender|mint|sand|tropical|autumn|spring|summer|winter|snow|rainbow|paper|notebook|book|pastel|aqua|robotics|sakura|kawaii|shojo|elves|castle|mythology|celestial|watercolor|origami|calligraphy|crystal|marble/)) return 'LIGHT';
  return 'DARK';
}

function semanticHue(key: string) {
  if (isMatch(key, /rose|sakura|kawaii|shojo|passion/)) return 338;
  if (isMatch(key, /red|underworld|fire|dragon|boss/)) return 4;
  if (isMatch(key, /orange|sunset|autumn|gold|sand|coffee|chocolate/)) return 28;
  if (isMatch(key, /green|nature|forest|spring|tropical|elves|mint/)) return 142;
  if (isMatch(key, /cyan|aqua|ocean|rain|sky|blue|tech/)) return 198;
  if (isMatch(key, /violet|galaxy|cosmic|nebula|quantum|spirit/)) return 272;
  if (isMatch(key, /black|carbon|dark|matrix|ninja|dungeon/)) return 220;
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function paletteFor(key: string, mode: ThemeMode): ThemePalette {
  if (mode === 'SYSTEM') {
    return {
      background: 'adaptive', backgroundAccent: 'adaptive', surface: 'adaptive',
      surfaceRaised: 'adaptive', surfaceGlass: 'adaptive', text: 'adaptive', muted: 'adaptive',
      accent: '#20c997', secondary: '#ff8a3d', border: 'adaptive', danger: '#e03131',
      onAccent: '#052017', statusBar: 'adaptive'
    };
  }
  const hue = semanticHue(key);
  const secondaryHue = (hue + 52) % 360;
  if (mode === 'LIGHT') {
    return {
      background: `hsl(${hue} 38% 96%)`, backgroundAccent: `hsl(${secondaryHue} 58% 88%)`,
      surface: `hsl(${hue} 42% 100%)`, surfaceRaised: `hsl(${hue} 40% 91%)`,
      surfaceGlass: `hsla(${hue} 42% 100% / .88)`, text: `hsl(${hue} 36% 13%)`,
      muted: `hsl(${hue} 18% 38%)`, accent: `hsl(${hue} 72% 38%)`,
      secondary: `hsl(${secondaryHue} 76% 42%)`, border: `hsla(${hue} 62% 34% / .28)`,
      danger: '#b42318', onAccent: '#ffffff', statusBar: 'dark'
    };
  }
  return {
    background: `hsl(${hue} 42% 7%)`, backgroundAccent: `hsl(${secondaryHue} 48% 16%)`,
    surface: `hsl(${hue} 34% 13%)`, surfaceRaised: `hsl(${hue} 38% 19%)`,
    surfaceGlass: `hsla(${hue} 34% 13% / .88)`, text: `hsl(${hue} 36% 96%)`,
    muted: `hsl(${hue} 18% 72%)`, accent: `hsl(${hue} 86% 66%)`,
    secondary: `hsl(${secondaryHue} 88% 65%)`, border: `hsla(${hue} 86% 66% / .28)`,
    danger: '#ff867a', onAccent: `hsl(${hue} 46% 8%)`, statusBar: 'light'
  };
}

function iconPackFor(order: number, key: string) {
  if (order <= 40) return ['rounded', 'filled', 'outline', 'soft-glass', 'material-plus'][(order - 1) % 5]!;
  const rules: Array<[RegExp, string]> = [
    [/crystal/, 'crystal'], [/neon|cyberpunk/, 'neon'], [/cyber|matrix|digital|tech/, 'cyber'],
    [/anime|sakura|kawaii|shonen|shojo|isekai|ninja|samurai|yokai|spirit/, 'anime'],
    [/pixel|arcade/, 'pixel'], [/fantasy|rpg|dungeon|kingdom|dragon|wizard|elves|castle|pirate|viking|mythology|underworld/, 'fantasy'],
    [/gold|samurai/, 'gold'], [/diamond|loot/, 'diamond'], [/galaxy|cosmic|milky|nebula|stars|constellation|planets/, 'cosmic'],
    [/watercolor/, 'liquid'], [/prestige/, 'glass-ultra'], [/black-hole|ninja/, 'matte-black'],
    [/celestial|marble|calligraphy/, 'white-pearl'], [/chrome|station|robot/, 'chrome'],
    [/quantum|graffiti/, 'gradient-dynamic'], [/mmorpg|battle|esport/, 'rgb-gaming'],
    [/hologram|future-ai|yokai/, 'holographic'], [/viking/, 'frost'], [/dragon|boss|underworld/, 'fire'],
    [/speed-run|wizard/, 'lightning']
  ];
  return rules.find(([pattern]) => pattern.test(key))?.[1] ?? 'glass-ultra';
}

function effectsFor(key: string, premium: boolean): readonly string[] {
  const rules: Array<[RegExp, readonly string[]]> = [
    [/rain/, ['rain', 'fog']], [/snow|winter|frost/, ['snow']], [/sakura/, ['sakura-petals']],
    [/shooting-stars/, ['shooting-stars', 'stars']], [/galaxy|milky|cosmic|nebula/, ['moving-galaxy', 'stars']],
    [/aurora/, ['aurora', 'light-particles']], [/ocean|aqua|tropical|pirate/, ['waves']],
    [/dragon|underworld|fire/, ['flames', 'embers']], [/forest|elves/, ['leaves', 'fireflies']],
    [/autumn/, ['autumn-leaves']], [/lightning|speed-run|quantum/, ['lightning']],
    [/kawaii|valentine/, ['hearts', 'bubbles']], [/gaming|esport|battle|loot|arcade/, ['rgb-wave', 'victory-confetti']],
    [/cyber|matrix|digital|hologram/, ['electric', 'data-stream']], [/fantasy|wizard|kingdom|isekai/, ['magic-dust']],
    [/classic|prestige|gold|diamond|crystal/, ['light-particles']]
  ];
  return rules.find(([pattern]) => pattern.test(key))?.[1] ?? (premium ? ['light-particles'] : []);
}

function appIconFor(key: string) {
  const mappings: Record<string, string> = {
    system: 'classique-knowme', 'light-minimal': 'clair', 'dark-elegant': 'sombre',
    'blue-ocean': 'bleu', 'rose-sakura': 'rose', 'galaxy-ultra': 'galaxy', cyberpunk: 'cyberpunk',
    'sakura-dream': 'sakura', esport: 'gaming-rgb', 'royal-gold': 'gold', diamond: 'diamond',
    'knowme-prestige': 'prestige', summer: 'ete', winter: 'hiver'
  };
  return mappings[key] ?? null;
}

const descriptions: Record<ThemeCategory, string> = {
  ESSENTIAL: 'une interface KnowMe équilibrée', NATURE: 'une atmosphère naturelle immersive',
  WEATHER: 'des effets météorologiques discrets', SEASON: 'une identité inspirée des saisons',
  UNIVERSE: 'une expérience cosmique profonde', FUTURISTIC: 'une interface technologique futuriste',
  ANIME: 'une direction artistique inspirée de l’anime et du manga', GAMING: 'une identité gaming dynamique',
  FANTASY: 'une ambiance fantasy riche', ARTISTIC: 'une composition visuelle artistique'
};

export const THEME_CATALOG: readonly ThemeDefinition[] = THEME_NAMES.map(([key, name], index) => {
  const order = index + 1;
  const tier: ThemeTier = order <= 40 ? 'FREE' : 'PREMIUM';
  const premium = tier === 'PREMIUM';
  const category = categoryFor(order, key);
  const mode = modeFor(key);
  const effects = effectsFor(key, premium);
  const appIconKey = appIconFor(key);
  return {
    order, key, name, category, mode, tier, premium,
    description: `${name} transforme couleurs, icônes, cartes, bulles et transitions pour créer ${descriptions[category]}${premium ? ' avec effets Premium' : ''}.`,
    palette: paletteFor(key, mode),
    iconPackKey: iconPackFor(order, key),
    effects,
    animationPreset: effects.length ? `${key}-motion` : 'none',
    soundPreset: effects.length ? `${category.toLowerCase()}-soft` : 'none',
    chatBubbleStyle: category.toLowerCase(),
    cardStyle: premium ? 'premium-depth' : 'soft-depth',
    transitionPreset: premium ? 'premium-fluid' : 'standard-fluid',
    appIconKey,
    entitlementKeys: premium ? [`theme.${key}`, 'subscription.premium'] : [],
    capabilities: {
      background: true, palette: true, icons: true, chatBubbles: true, controls: true,
      cards: true, menus: true, transitions: true, openingAnimation: effects.length > 0,
      uiSounds: effects.length > 0, messageEffects: effects.length > 0,
      notificationEffects: effects.length > 0, profileFrames: true, badges: true,
      reactions: true, progress: true, loaders: true, knowCoins: true, challenges: true,
      leaderboards: true, rewardChests: true, homeWidgets: true,
      alternateAppIcon: Boolean(appIconKey)
    }
  };
});

export const SEASONAL_THEMES = [
  { key: 'christmas', name: 'Noël', scheduleKey: 'appearance.season.christmas', effects: ['snow', 'light-particles'], iconPackKey: 'frost' },
  { key: 'halloween', name: 'Halloween', scheduleKey: 'appearance.season.halloween', effects: ['fog', 'spirit-flames'], iconPackKey: 'fire' },
  { key: 'valentine', name: 'Saint-Valentin', scheduleKey: 'appearance.season.valentine', effects: ['hearts', 'petals'], iconPackKey: 'crystal' },
  { key: 'new-year', name: 'Nouvel An', scheduleKey: 'appearance.season.new-year', effects: ['confetti', 'light-particles'], iconPackKey: 'gold' },
  { key: 'ramadan', name: 'Ramadan', scheduleKey: 'appearance.season.ramadan', effects: ['stars', 'light-particles'], iconPackKey: 'cosmic' },
  { key: 'easter', name: 'Pâques', scheduleKey: 'appearance.season.easter', effects: ['petals', 'butterflies'], iconPackKey: 'soft-glass' },
  { key: 'national-holiday', name: 'Fête nationale', scheduleKey: 'appearance.season.national-holiday', effects: ['confetti'], iconPackKey: 'filled' },
  { key: 'sakura-festival', name: 'Festival Sakura', scheduleKey: 'appearance.season.sakura-festival', effects: ['sakura-petals'], iconPackKey: 'anime' },
  { key: 'summer-vibes', name: 'Summer Vibes', scheduleKey: 'appearance.season.summer-vibes', effects: ['waves', 'sun-rays'], iconPackKey: 'liquid' },
  { key: 'winter-magic', name: 'Winter Magic', scheduleKey: 'appearance.season.winter-magic', effects: ['snow', 'aurora'], iconPackKey: 'frost' }
] as const;

export const EVENT_ICON_PACKS = [
  'christmas', 'halloween', 'new-year', 'valentine', 'anime-festival',
  'world-cup', 'olympics', 'knowme-seasons'
] as const;

export const PREMIUM_CUSTOMIZATION_CAPABILITIES = {
  customThemes: true,
  independentIconPack: true,
  iconSize: true,
  iconRoundness: true,
  iconTransparency: true,
  iconStrokeWidth: true,
  perTabIconPack: true,
  personalWallpaperImport: true,
  automaticRotation: ['TIME', 'SEASON'],
  weatherEffectsRequirePermission: true,
  customLoadingScreens: true,
  premiumTransitions: true,
  unlockAnimations: true,
  themeCombinations: true,
  soundsOptInByDefault: true,
  functionalAdvantagesAllowed: false
} as const;

export function isUnlocked(entitlementKeys: readonly string[], activeEntitlements: ReadonlySet<string>) {
  return entitlementKeys.length === 0 || entitlementKeys.some((key) => activeEntitlements.has(key));
}

function assertCatalogIntegrity() {
  if (THEME_CATALOG.length !== 100) throw new Error('Le catalogue KnowMe doit contenir exactement 100 thèmes.');
  if (THEME_CATALOG.filter((theme) => theme.tier === 'FREE').length !== 40) throw new Error('Le catalogue doit contenir 40 thèmes gratuits.');
  if (THEME_CATALOG.filter((theme) => theme.tier === 'PREMIUM').length !== 60) throw new Error('Le catalogue doit contenir 60 thèmes Premium.');
  const keys = new Set<string>();
  const iconKeys = new Set(ICON_PACKS.map((pack) => pack.key));
  const appIconKeys = new Set(APP_ICONS.map((icon) => icon.key));
  for (const [index, theme] of THEME_CATALOG.entries()) {
    if (theme.order !== index + 1) throw new Error(`Ordre de thème invalide : ${theme.key}.`);
    if (keys.has(theme.key)) throw new Error(`Clé de thème dupliquée : ${theme.key}.`);
    if (!iconKeys.has(theme.iconPackKey)) throw new Error(`Pack d’icônes inconnu : ${theme.iconPackKey}.`);
    if (theme.appIconKey && !appIconKeys.has(theme.appIconKey)) throw new Error(`Icône d’application inconnue : ${theme.appIconKey}.`);
    keys.add(theme.key);
  }
}

assertCatalogIntegrity();
