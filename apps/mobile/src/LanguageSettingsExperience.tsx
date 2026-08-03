import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';

export function LanguageSettingsExperience() {
  const { colors } = useAppearance();
  const { locale, version, persisted, syncLocale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function change(nextLocale: 'fr' | 'en') {
    if (busy || (nextLocale === locale && persisted)) return;
    setBusy(true);
    setMessage('');
    try {
      await syncLocale(nextLocale);
      setMessage(t('settings.languageSaved'));
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : t('settings.languageConflict')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border }
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t('settings.languageTitle')}
      </Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        {t('settings.languageDescription')}
      </Text>
      <View style={styles.actions}>
        {(['fr', 'en'] as const).map((candidate) => {
          const selected = candidate === locale;
          return (
            <Pressable
              key={candidate}
              disabled={busy}
              onPress={() => void change(candidate)}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: selected ? colors.accent : colors.surfaceRaised,
                  borderColor: colors.border
                },
                (pressed || busy) && styles.muted
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.accentText : colors.text,
                  fontWeight: '900'
                }}
              >
                {candidate === 'fr' ? t('common.french') : t('common.english')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.meta, { color: colors.muted }]}>
        {t('settings.languageFallback')} · v{version}
        {persisted ? '' : ' · appareil'}
      </Text>
      {message ? (
        <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12
  },
  title: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  muted: { opacity: 0.5 },
  meta: { fontSize: 12, lineHeight: 18 },
  message: { fontWeight: '800' }
});
