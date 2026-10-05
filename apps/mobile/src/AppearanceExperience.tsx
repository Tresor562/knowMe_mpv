import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  AppearanceTheme,
  AppearanceUpdateInput,
  MobileThemePalette
} from './appearance';
import { useAppearance } from './AppearanceProvider';
import { ChatWallpaper, KnowMeIcon } from './ui/KnowMeUI';

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'Tout',
  ESSENTIAL: 'Essentiels',
  NATURE: 'Nature',
  WEATHER: 'Météo',
  SEASON: 'Saisons',
  UNIVERSE: 'Univers',
  FUTURISTIC: 'Futur',
  ANIME: 'Anime',
  GAMING: 'Gaming',
  FANTASY: 'Fantasy',
  ARTISTIC: 'Art'
};

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Préférences d’apparence indisponibles.';
}

function visibleColor(value: string, fallback: string) {
  return value === 'adaptive' ? fallback : value;
}

function previewGeometry(theme: AppearanceTheme) {
  const category = theme.category.toUpperCase();
  if (category === 'FUTURISTIC' || category === 'GAMING') {
    return { panelRadius: 12, bubbleRadius: 8, inset: 7 };
  }
  if (category === 'ANIME' || category === 'FANTASY' || category === 'NATURE' || category === 'SEASON') {
    return { panelRadius: 20, bubbleRadius: 13, inset: 8 };
  }
  if (category === 'ARTISTIC') {
    return { panelRadius: 17, bubbleRadius: 11, inset: 9 };
  }
  return { panelRadius: 15, bubbleRadius: 10, inset: 8 };
}

function ThemePreview({
  theme,
  colors
}: {
  theme: AppearanceTheme;
  colors: MobileThemePalette;
}) {
  const geometry = previewGeometry(theme);
  const category = theme.category.toUpperCase();
  const background = visibleColor(theme.palette.background, colors.background);
  const surface = visibleColor(theme.palette.surface, colors.surface);
  const raised = visibleColor(theme.palette.surfaceRaised, colors.surfaceRaised);
  const accent = theme.palette.accent;
  const secondary = theme.palette.secondary;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.preview,
        {
          backgroundColor: background,
          borderColor: theme.palette.border === 'adaptive' ? colors.border : theme.palette.border,
          borderRadius: geometry.panelRadius,
          padding: geometry.inset
        }
      ]}
    >
      <View style={styles.previewTopBar}>
        <View style={[styles.previewAvatar, { backgroundColor: accent }]} />
        <View style={[styles.previewTitleLine, { backgroundColor: visibleColor(theme.palette.muted, colors.muted) }]} />
        <View style={[styles.previewTinyDot, { backgroundColor: secondary }]} />
      </View>

      <View style={styles.previewScene}>
        {(category === 'UNIVERSE' || category === 'WEATHER' || category === 'ARTISTIC') ? (
          <>
            <View style={[styles.previewDecorOne, { backgroundColor: secondary }]} />
            <View style={[styles.previewDecorTwo, { backgroundColor: accent }]} />
          </>
        ) : null}
        {(category === 'FUTURISTIC' || category === 'GAMING') ? (
          <>
            <View style={[styles.previewGridLine, styles.previewGridLineOne, { backgroundColor: accent }]} />
            <View style={[styles.previewGridLine, styles.previewGridLineTwo, { backgroundColor: secondary }]} />
          </>
        ) : null}

        <View
          style={[
            styles.previewBubbleMini,
            styles.previewBubbleMiniIncoming,
            {
              backgroundColor: surface,
              borderRadius: geometry.bubbleRadius
            }
          ]}
        />
        <View
          style={[
            styles.previewBubbleMini,
            styles.previewBubbleMiniOutgoing,
            {
              backgroundColor: accent,
              borderRadius: geometry.bubbleRadius
            }
          ]}
        />
        <View
          style={[
            styles.previewComposer,
            {
              backgroundColor: raised,
              borderRadius: Math.max(7, geometry.bubbleRadius)
            }
          ]}
        >
          <View style={[styles.previewComposerLine, { backgroundColor: visibleColor(theme.palette.muted, colors.muted) }]} />
          <View style={[styles.previewSend, { backgroundColor: accent }]} />
        </View>
      </View>
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  disabled = false,
  colors,
  onPress
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  colors: MobileThemePalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceRaised,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1
        }
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.accentText : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ThemeButton({
  theme,
  selected,
  disabled,
  onPress,
  colors
}: {
  theme: AppearanceTheme;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: MobileThemePalette;
}) {
  const { visual } = useAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeButton,
        { borderRadius: visual.controlRadius },
        {
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled ? 0.52 : pressed ? 0.76 : 1
        }
      ]}
    >
      <ThemePreview theme={theme} colors={colors} />
      <View style={styles.themeCopy}>
        <View style={styles.themeMetaRow}>
          <Text style={[styles.themeMeta, { color: colors.accent }]}>
            {CATEGORY_LABELS[theme.category] ?? theme.category}
          </Text>
          {theme.tier === 'PREMIUM' ? (
            <View style={[styles.premiumPill, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="spark" size={12} color={colors.secondary} />
              <Text style={[styles.premiumPillText, { color: colors.secondary }]}>Premium</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.themeName, { color: colors.text }]}>{theme.name}</Text>
        <Text style={[styles.themeDescription, { color: colors.muted }]} numberOfLines={2}>
          {theme.description}
        </Text>
        <Text style={[styles.themeStatus, { color: selected ? colors.accent : colors.muted }]} numberOfLines={1}>
          {theme.locked
            ? 'À débloquer'
            : selected
              ? 'Actif sur KnowMe'
              : theme.effects.length > 0
                ? 'Fond, bulles et effets adaptés'
                : 'Interface et bulles adaptées'}
        </Text>
      </View>
    </Pressable>
  );
}

function ToggleOption({
  title,
  description,
  value,
  disabled,
  colors,
  onValueChange
}: {
  title: string;
  description: string;
  value: boolean;
  disabled: boolean;
  colors: MobileThemePalette;
  onValueChange: (enabled: boolean) => void;
}) {
  return (
    <View style={[styles.optionRow, { borderColor: colors.border }]}>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionDescription, { color: colors.muted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function AppearanceExperience() {
  const { appearance, colors, visual, chat, loading, busy, refresh, update } = useAppearance();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [tier, setTier] = useState<'ALL' | 'FREE' | 'PREMIUM'>('ALL');
  const [showAll, setShowAll] = useState(false);

  async function save(input: AppearanceUpdateInput) {
    if (!appearance || busy) return;
    try {
      await update(input);
    } catch (cause) {
      Alert.alert('Synchronisation impossible', errorMessage(cause));
      await refresh();
    }
  }

  const filteredThemes = useMemo(() => {
    if (!appearance) return [];
    const normalized = query.trim().toLocaleLowerCase('fr');
    return appearance.themes.filter((theme) => {
      if (category !== 'ALL' && theme.category !== category) return false;
      if (tier !== 'ALL' && theme.tier !== tier) return false;
      if (!normalized) return true;
      return [theme.name, theme.description, theme.iconPackKey, ...theme.effects]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(normalized);
    });
  }, [appearance, category, query, tier]);

  if (loading && !appearance) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Chargement de la personnalisation…</Text>
      </View>
    );
  }

  if (!appearance) return null;

  const preference = appearance.preference;
  const renderedThemes = showAll ? filteredThemes : filteredThemes.slice(0, 12);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>APPARENCE</Text>
        <Text style={[styles.heading, { color: colors.text }]}>Fais de KnowMe ton espace</Text>
        <Text style={[styles.description, { color: colors.muted }]}>
          Chaque famille peut modifier la géométrie, le verre, les bulles, le fond du chat et les effets — pas seulement la palette.
        </Text>
      </View>

      {preference.fallbackReason ? (
        <View style={[styles.notice, { borderColor: colors.accent }]}>
          <Text style={[styles.noticeText, { color: colors.text }]}> 
            Le choix reste enregistré, mais Classique KnowMe est appliqué car le droit actif manque.
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.chatPreview,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderRadius: visual.cardRadius
          }
        ]}
      >
        <ChatWallpaper />
        <View style={styles.chatPreviewHeader}>
          <Text style={[styles.chatPreviewTitle, { color: colors.text }]}>Aperçu du chat</Text>
          <Text style={[styles.chatPreviewMeta, { color: colors.muted }]}>
            {appearance.themes.find((theme) => theme.key === preference.effectiveThemeKey)?.name ?? 'KnowMe'}
          </Text>
        </View>
        <View
          style={[
            styles.previewBubble,
            styles.previewBubbleIncoming,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: chat.bubbleBorderWidth,
              borderRadius: visual.bubbleRadius
            }
          ]}
        >
          <Text style={[styles.previewBubbleText, { color: colors.text }]}>
            Le thème change aussi le fond et les bulles.
          </Text>
        </View>
        <View
          style={[
            styles.previewBubble,
            styles.previewBubbleOutgoing,
            {
              backgroundColor: colors.accent,
              borderColor: colors.accent,
              borderWidth: chat.bubbleBorderWidth,
              borderRadius: visual.bubbleRadius
            }
          ]}
        >
          <Text style={[styles.previewBubbleText, { color: colors.accentText }]}>
            Pas seulement les couleurs.
          </Text>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setShowAll(false);
        }}
        placeholder="Galaxy, Sakura, gaming, pluie…"
        placeholderTextColor={colors.muted}
        style={[
          styles.search,
          { backgroundColor: colors.backgroundAccent, borderColor: colors.border, color: colors.text, borderRadius: visual.inputRadius }
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <ChoiceChip
            key={value}
            label={label}
            selected={category === value}
            colors={colors}
            onPress={() => {
              setCategory(value);
              setShowAll(false);
            }}
          />
        ))}
      </ScrollView>

      <View style={styles.chipRow}>
        {(['ALL', 'FREE', 'PREMIUM'] as const).map((value) => (
          <ChoiceChip
            key={value}
            label={value === 'ALL' ? 'Tous les accès' : value === 'FREE' ? 'Gratuits' : 'Premium'}
            selected={tier === value}
            colors={colors}
            onPress={() => {
              setTier(value);
              setShowAll(false);
            }}
          />
        ))}
      </View>

      <View style={styles.resultRow}>
        <Text style={[styles.resultCount, { color: colors.muted }]}>
          {filteredThemes.length} thème(s)
        </Text>
        <Text style={[styles.resultHint, { color: colors.muted }]}>
          Appuie sur un thème pour l’appliquer
        </Text>
      </View>

      <View style={styles.themeGrid}>
        {renderedThemes.map((theme) => (
          <ThemeButton
            key={theme.key}
            theme={theme}
            colors={colors}
            selected={preference.selectedThemeKey === theme.key}
            disabled={busy || theme.locked || preference.selectedThemeKey === theme.key}
            onPress={() => void save({ themeKey: theme.key })}
          />
        ))}
      </View>

      {filteredThemes.length > 12 ? (
        <Pressable
          onPress={() => setShowAll((current) => !current)}
          style={[styles.secondaryButton, { borderColor: colors.accent, borderRadius: visual.controlRadius }]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.accent }]}> 
            {showAll ? 'Réduire la liste' : `Afficher les ${filteredThemes.length} thèmes`}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pack d’icônes</Text>
        <Text style={[styles.sectionDescription, { color: colors.muted }]}> 
          Le pack automatique suit le thème. Premium peut mélanger un pack différent.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <ChoiceChip
            label="Automatique"
            selected={preference.selectedIconPackKey === null}
            disabled={busy}
            colors={colors}
            onPress={() => void save({ iconPackKey: 'theme-default' })}
          />
          {appearance.iconPacks.map((pack) => (
            <ChoiceChip
              key={pack.key}
              label={`${pack.name}${pack.animated ? ' ✦' : ''}`}
              selected={preference.selectedIconPackKey === pack.key}
              disabled={busy || pack.locked}
              colors={colors}
              onPress={() => void save({ iconPackKey: pack.key })}
            />
          ))}
        </ScrollView>
        <Text style={[styles.version, { color: colors.muted }]}> 
          Pack effectif : {preference.effectiveIconPackKey}
        </Text>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Icône de l’application</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <ChoiceChip
            label="Automatique"
            selected={preference.selectedAppIconKey === null}
            disabled={busy}
            colors={colors}
            onPress={() => void save({ appIconKey: 'theme-default' })}
          />
          {appearance.appIcons.map((icon) => (
            <ChoiceChip
              key={icon.key}
              label={`${icon.name}${icon.seasonal ? ' ✦' : ''}`}
              selected={preference.selectedAppIconKey === icon.key}
              disabled={busy || icon.locked}
              colors={colors}
              onPress={() => void save({ appIconKey: icon.key })}
            />
          ))}
        </ScrollView>
        <Text style={[styles.version, { color: colors.muted }]}> 
          Icône effective : {preference.effectiveAppIconKey ?? 'défaut de la plateforme'}.
          Le changement natif s’applique sans réinstallation sur les plateformes compatibles.
        </Text>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Effets et batterie</Text>
        <ToggleOption
          title="Animations du thème"
          description="Désactive pluie, neige, pétales, particules et transitions."
          value={preference.animationsEnabled}
          disabled={busy}
          colors={colors}
          onValueChange={(enabled) => void save({ animationsEnabled: enabled })}
        />
        <ToggleOption
          title="Icônes animées"
          description="Mouvements discrets des onglets et notifications compatibles."
          value={preference.animatedIconsEnabled}
          disabled={busy || !preference.animationsEnabled}
          colors={colors}
          onValueChange={(enabled) => void save({ animatedIconsEnabled: enabled })}
        />
        <ToggleOption
          title="Sons d’interface"
          description="Toujours optionnels et désactivés par défaut."
          value={preference.uiSoundsEnabled}
          disabled={busy}
          colors={colors}
          onValueChange={(enabled) => void save({ uiSoundsEnabled: enabled })}
        />
        <ToggleOption
          title="Effets météo Premium"
          description="Nécessitent Premium et l’autorisation de météo/localisation."
          value={preference.weatherEffectsEnabled}
          disabled={busy}
          colors={colors}
          onValueChange={(enabled) => void save({ weatherEffectsEnabled: enabled })}
        />
        <Text style={[styles.optionTitle, { color: colors.text }]}>Intensité</Text>
        <View style={styles.chipRow}>
          {(['LOW', 'BALANCED', 'HIGH'] as const).map((value) => (
            <ChoiceChip
              key={value}
              label={value === 'LOW' ? 'Économie' : value === 'BALANCED' ? 'Équilibrée' : 'Riche'}
              selected={preference.effectIntensity === value}
              disabled={busy || !preference.animationsEnabled}
              colors={colors}
              onPress={() => void save({ effectIntensity: value })}
            />
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Accessibilité</Text>
        <ToggleOption
          title="Contraste élevé"
          description="Renforce les séparations, bordures et textes secondaires."
          value={preference.contrast === 'HIGH'}
          disabled={busy}
          colors={colors}
          onValueChange={(enabled) => void save({ contrast: enabled ? 'HIGH' : 'STANDARD' })}
        />
        <ToggleOption
          title="Réduire la transparence"
          description="Remplace les surfaces translucides par des aplats stables."
          value={preference.reduceTransparency}
          disabled={busy}
          colors={colors}
          onValueChange={(enabled) => void save({ reduceTransparency: enabled })}
        />
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Combinaison Premium</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <ChoiceChip
            label="Aucun thème secondaire"
            selected={preference.secondaryThemeKey === null}
            disabled={busy}
            colors={colors}
            onPress={() => void save({ secondaryThemeKey: 'none', themeBlendMode: 'OFF' })}
          />
          {appearance.themes
            .filter((theme) => !theme.locked && theme.key !== preference.selectedThemeKey)
            .slice(0, 24)
            .map((theme) => (
              <ChoiceChip
                key={theme.key}
                label={theme.name}
                selected={preference.secondaryThemeKey === theme.key}
                disabled={busy}
                colors={colors}
                onPress={() => void save({ secondaryThemeKey: theme.key })}
              />
            ))}
        </ScrollView>
        <View style={styles.chipRow}>
          {(['OFF', 'ACCENT', 'EFFECTS', 'BALANCED'] as const).map((value) => (
            <ChoiceChip
              key={value}
              label={value === 'OFF' ? 'Désactivée' : value === 'ACCENT' ? 'Accents' : value === 'EFFECTS' ? 'Effets' : 'Équilibrée'}
              selected={preference.themeBlendMode === value}
              disabled={busy}
              colors={colors}
              onPress={() => void save({ themeBlendMode: value })}
            />
          ))}
        </View>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Rotation Premium</Text>
        <View style={styles.chipRow}>
          {(['OFF', 'TIME', 'SEASON'] as const).map((value) => (
            <ChoiceChip
              key={value}
              label={value === 'OFF' ? 'Désactivée' : value === 'TIME' ? 'Selon l’heure' : 'Selon la saison'}
              selected={preference.automaticRotationMode === value}
              disabled={busy}
              colors={colors}
              onPress={() => void save({ automaticRotationMode: value })}
            />
          ))}
        </View>
        <Text style={[styles.version, { color: colors.muted }]}> 
          Les fenêtres saisonnières sont pilotées par le serveur et peuvent varier selon le pays.
        </Text>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Saisons KnowMe</Text>
        <View style={styles.seasonGrid}>
          {appearance.seasonalThemes.map((theme) => (
            <View key={theme.key} style={[styles.seasonCard, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[styles.seasonName, { color: colors.text }]}>{theme.name}</Text>
              <Text style={[styles.seasonStatus, { color: colors.accent }]}> 
                {theme.available ? 'Disponible' : 'Hors saison'}
              </Text>
              <Text style={[styles.seasonEffects, { color: colors.muted }]} numberOfLines={2}>
                {theme.effects.join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.version, { color: colors.muted }]}> 
        Thème effectif : {preference.effectiveThemeKey} · fusion :{' '}
        {preference.effectiveThemeBlendMode} · version serveur : {preference.version}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chatPreview: {
    minHeight: 220,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    gap: 10,
    position: 'relative'
  },
  chatPreviewHeader: {
    marginBottom: 12
  },
  chatPreviewTitle: {
    fontSize: 16,
    fontWeight: '900'
  },
  chatPreviewMeta: {
    fontSize: 11,
    marginTop: 2
  },
  previewBubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  previewBubbleIncoming: {
    alignSelf: 'flex-start'
  },
  previewBubbleOutgoing: {
    alignSelf: 'flex-end'
  },
  previewBubbleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600'
  },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 15, gap: 14 },
  loadingText: { textAlign: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heading: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  description: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultCount: { fontSize: 11.5, fontWeight: '700' },
  resultHint: { fontSize: 10.5, flexShrink: 1, textAlign: 'right' },
  themeGrid: { gap: 10 },
  themeButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 10, flexDirection: 'row', gap: 11, alignItems: 'center' },
  preview: { width: 82, height: 96, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  previewTopBar: { height: 15, flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewAvatar: { width: 10, height: 10, borderRadius: 5 },
  previewTitleLine: { width: 26, height: 4, borderRadius: 2, opacity: 0.55 },
  previewTinyDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 'auto' },
  previewScene: { flex: 1, position: 'relative', justifyContent: 'flex-end', gap: 4 },
  previewBubbleMini: { height: 13, width: '63%' },
  previewBubbleMiniIncoming: { alignSelf: 'flex-start' },
  previewBubbleMiniOutgoing: { alignSelf: 'flex-end' },
  previewComposer: { height: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, gap: 4 },
  previewComposerLine: { height: 3, borderRadius: 2, flex: 1, opacity: 0.45 },
  previewSend: { width: 8, height: 8, borderRadius: 4 },
  previewDecorOne: { position: 'absolute', width: 22, height: 22, borderRadius: 11, right: -7, top: 2, opacity: 0.11 },
  previewDecorTwo: { position: 'absolute', width: 13, height: 13, borderRadius: 7, left: 4, top: 11, opacity: 0.1 },
  previewGridLine: { position: 'absolute', height: StyleSheet.hairlineWidth, opacity: 0.18, transform: [{ rotate: '-18deg' }] },
  previewGridLineOne: { width: 56, top: 17, left: 5 },
  previewGridLineTwo: { width: 42, top: 28, right: 0 },
  themeCopy: { flex: 1, gap: 3 },
  themeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  themeMeta: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  premiumPill: { minHeight: 20, borderRadius: 10, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  premiumPillText: { fontSize: 9, fontWeight: '800' },
  themeName: { fontSize: 14.5, fontWeight: '800' },
  themeDescription: { fontSize: 11.5, lineHeight: 16 },
  themeStatus: { fontSize: 10.5, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 11 },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  sectionDescription: { fontSize: 12, lineHeight: 17 },
  optionRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 13 },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '800' },
  optionDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  seasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonCard: { width: '48%', borderRadius: 13, padding: 10, gap: 3 },
  seasonName: { fontSize: 12, fontWeight: '900' },
  seasonStatus: { fontSize: 10, fontWeight: '800' },
  seasonEffects: { fontSize: 10, lineHeight: 14 },
  version: { fontSize: 11, lineHeight: 16 }
});
