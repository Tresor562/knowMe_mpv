import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SupportedLocale } from '@knowme/i18n-contract';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { LanguagePicker } from './LanguagePicker';
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

export function LanguageSettingsExperience() {
  const { colors, visual } = useAppearance();
  const { locale, persisted, syncLocale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function change(nextLocale: SupportedLocale) {
    if (busy || (nextLocale === locale && persisted)) return;
    setBusy(true);
    setMessage('');
    try {
      await syncLocale(nextLocale);
      setMessage(t('settings.languageSaved'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : t('settings.languageConflict'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="discover" size={20} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{t('settings.languageTitle')}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{t('settings.languageDescription')}</Text>
        </View>
      </View>
      <LanguagePicker
        value={locale}
        onChange={(nextLocale) => change(nextLocale)}
      />
      <Text style={[styles.meta, { color: colors.muted }]}>
        {t('settings.languageFallback')}{persisted ? ' · synchronisée' : ' · cet appareil'}
      </Text>
      {message ? <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text> : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  muted: { opacity: 0.5 },
  meta: { fontSize: 11, lineHeight: 16 },
  message: { fontSize: 11.5, fontWeight: '700' }
});
