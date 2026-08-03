import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';
import { AppearanceTheme, MobileThemePalette } from './appearance';
import { useAppearance } from './AppearanceProvider';

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Préférences d’apparence indisponibles.';
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
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1
        }
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.preview,
          {
            backgroundColor:
              theme.palette.background === 'adaptive'
                ? colors.background
                : theme.palette.background,
            borderColor: theme.palette.accent
          }
        ]}
      >
        <View style={[styles.previewAccent, { backgroundColor: theme.palette.accent }]} />
        <View
          style={[
            styles.previewSurface,
            {
              backgroundColor:
                theme.palette.surface === 'adaptive'
                  ? colors.surface
                  : theme.palette.surface
            }
          ]}
        />
      </View>
      <View style={styles.themeCopy}>
        <Text style={[styles.themeName, { color: colors.text }]}>{theme.name}</Text>
        <Text style={[styles.themeDescription, { color: colors.muted }]}>
          {theme.description}
        </Text>
        <Text style={[styles.themeStatus, { color: colors.accent }]}>
          {theme.locked
            ? 'Droit Premium requis'
            : selected
              ? 'Sélectionné'
              : theme.mode === 'SYSTEM'
                ? 'Suit l’appareil'
                : theme.mode === 'LIGHT'
                  ? 'Palette claire'
                  : 'Palette sombre'}
        </Text>
      </View>
    </Pressable>
  );
}

export function AppearanceExperience() {
  const { appearance, colors, loading, busy, refresh, update } = useAppearance();

  async function save(input: {
    themeKey?: string;
    contrast?: 'STANDARD' | 'HIGH';
    reduceTransparency?: boolean;
  }) {
    if (!appearance || busy) return;
    try {
      await update(input);
    } catch (cause) {
      Alert.alert('Synchronisation impossible', errorMessage(cause));
      await refresh();
    }
  }

  if (loading && !appearance) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Chargement de l’apparence…</Text>
      </View>
    );
  }

  if (!appearance) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>APPARENCE SYNCHRONISÉE</Text>
        <Text style={[styles.heading, { color: colors.text }]}>Thème de l’application</Text>
        <Text style={[styles.description, { color: colors.muted }]}> 
          Les palettes sont statiques et purement visuelles. Elles ne modifient ni les fonctions,
          ni les récompenses, ni la priorité sociale.
        </Text>
      </View>

      {appearance.preference.fallbackReason ? (
        <View style={[styles.notice, { borderColor: colors.accent }]}>
          <Text style={[styles.noticeText, { color: colors.text }]}> 
            Le thème sélectionné n’est plus autorisé. Le mode système est appliqué en sécurité,
            sans effacer ton choix.
          </Text>
        </View>
      ) : null}

      <View style={styles.themeGrid}>
        {appearance.themes.map((theme) => (
          <ThemeButton
            key={theme.key}
            theme={theme}
            colors={colors}
            selected={appearance.preference.selectedThemeKey === theme.key}
            disabled={busy || theme.locked || appearance.preference.selectedThemeKey === theme.key}
            onPress={() => void save({ themeKey: theme.key })}
          />
        ))}
      </View>

      <View style={[styles.optionRow, { borderColor: colors.border }]}>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Contraste élevé</Text>
          <Text style={[styles.optionDescription, { color: colors.muted }]}> 
            Renforce les séparations, bordures et textes secondaires.
          </Text>
        </View>
        <Switch
          value={appearance.preference.contrast === 'HIGH'}
          disabled={busy}
          onValueChange={(enabled) =>
            void save({ contrast: enabled ? 'HIGH' : 'STANDARD' })
          }
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>

      <View style={[styles.optionRow, { borderColor: colors.border }]}>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Réduire la transparence</Text>
          <Text style={[styles.optionDescription, { color: colors.muted }]}> 
            Remplace les surfaces translucides par des aplats stables.
          </Text>
        </View>
        <Switch
          value={appearance.preference.reduceTransparency}
          disabled={busy}
          onValueChange={(enabled) => void save({ reduceTransparency: enabled })}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>

      <Text style={[styles.version, { color: colors.muted }]}> 
        Thème effectif : {appearance.preference.effectiveThemeKey} · version serveur :{' '}
        {appearance.preference.version}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 16
  },
  loadingText: {
    textAlign: 'center'
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  heading: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 5
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19
  },
  themeGrid: {
    gap: 10
  },
  themeButton: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  preview: {
    width: 66,
    height: 58,
    borderWidth: 1,
    borderRadius: 13,
    padding: 8,
    gap: 8
  },
  previewAccent: {
    width: '75%',
    height: 8,
    borderRadius: 99
  },
  previewSurface: {
    width: '52%',
    height: 7,
    borderRadius: 99
  },
  themeCopy: {
    flex: 1,
    gap: 3
  },
  themeName: {
    fontSize: 15,
    fontWeight: '900'
  },
  themeDescription: {
    fontSize: 12,
    lineHeight: 17
  },
  themeStatus: {
    fontSize: 11,
    fontWeight: '800'
  },
  optionRow: {
    borderTopWidth: 1,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  optionCopy: {
    flex: 1
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  version: {
    fontSize: 11,
    lineHeight: 16
  }
});
