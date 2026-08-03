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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeButton,
        {
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled ? 0.52 : pressed ? 0.76 : 1
        }
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.preview,
          {
            backgroundColor: visibleColor(theme.palette.background, colors.background),
            borderColor: theme.palette.accent
          }
        ]}
      >
        <View style={[styles.previewAccent, { backgroundColor: theme.palette.accent }]} />
        <View
          style={[
            styles.previewSurface,
            { backgroundColor: visibleColor(theme.palette.surface, colors.surface) }
          ]}
        />
        <View style={[styles.previewDot, { backgroundColor: theme.palette.secondary }]} />
      </View>
      <View style={styles.themeCopy}>
        <Text style={[styles.themeMeta, { color: colors.accent }]}> 
          #{theme.order} · {theme.tier} · {CATEGORY_LABELS[theme.category] ?? theme.category}
        </Text>
        <Text style={[styles.themeName, { color: colors.text }]}>{theme.name}</Text>
        <Text style={[styles.themeDescription, { color: colors.muted }]} numberOfLines={2}>
          {theme.description}
        </Text>
        <Text style={[styles.themeStatus, { color: colors.accent }]} numberOfLines={1}>
          {theme.locked
            ? 'Premium ou possession requise'
            : selected
              ? 'Sélectionné'
              : `${theme.iconPackKey} · ${theme.effects.length} effet(s)`}
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
  const { appearance, colors, loading, busy, refresh, update } = useAppearance();
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
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Chargement de la personnalisation…</Text>
      </View>
    );
  }

  if (!appearance) return null;

  const preference = appearance.preference;
  const renderedThemes = showAll ? filteredThemes : filteredThemes.slice(0, 12);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>IDENTITÉ VISUELLE KNOWME</Text>
        <Text style={[styles.heading, { color: colors.text }]}>Ton univers personnel</Text>
        <Text style={[styles.description, { color: colors.muted }]}> 
          100 thèmes synchronisés transforment couleurs, icônes, bulles, cartes, transitions,
          effets et sons optionnels sans changer l’ergonomie ni les avantages du compte.
        </Text>
        <View style={styles.summaryRow}>
          {['40 gratuits', '60 Premium', '25 packs', '10 saisons'].map((label) => (
            <View key={label} style={[styles.summaryBadge, { backgroundColor: colors.surfaceRaised }]}>
              <Text style={[styles.summaryText, { color: colors.text }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {preference.fallbackReason ? (
        <View style={[styles.notice, { borderColor: colors.accent }]}>
          <Text style={[styles.noticeText, { color: colors.text }]}> 
            Le choix reste enregistré, mais Classique KnowMe est appliqué car le droit actif manque.
          </Text>
        </View>
      ) : null}

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
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }
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

      <Text style={[styles.resultCount, { color: colors.muted }]}>
        {filteredThemes.length} thème(s) · {renderedThemes.length} affiché(s)
      </Text>

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
          style={[styles.secondaryButton, { borderColor: colors.accent }]}
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
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 16 },
  loadingText: { textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 22, fontWeight: '900', marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 7 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  summaryBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  summaryText: { fontSize: 11, fontWeight: '800' },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  search: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '800' },
  resultCount: { fontSize: 12, fontWeight: '700' },
  themeGrid: { gap: 10 },
  themeButton: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  preview: { width: 70, height: 64, borderWidth: 1, borderRadius: 13, padding: 8, gap: 7 },
  previewAccent: { width: '75%', height: 8, borderRadius: 99 },
  previewSurface: { width: '52%', height: 7, borderRadius: 99 },
  previewDot: { width: 10, height: 10, borderRadius: 99, alignSelf: 'flex-end' },
  themeCopy: { flex: 1, gap: 3 },
  themeMeta: { fontSize: 10, fontWeight: '900' },
  themeName: { fontSize: 15, fontWeight: '900' },
  themeDescription: { fontSize: 12, lineHeight: 17 },
  themeStatus: { fontSize: 11, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },
  section: { borderTopWidth: 1, paddingTop: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  sectionDescription: { fontSize: 12, lineHeight: 17 },
  optionRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
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
