import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SupportedLocale } from '@knowme/i18n-contract';
import { useAppearance } from './AppearanceProvider';
import { CreatorSettingsExperience } from './CreatorSettingsExperience';
import { useI18n } from './I18nProvider';
import { MediaDownloadSettingsExperience } from './MediaDownloadSettingsExperience';
import { LanguagePicker } from './LanguagePicker';

export function LanguageSettingsExperience() {
  const { colors, visual } = useAppearance();
  const { locale, version, persisted, syncLocale, t } = useI18n();
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
    <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.languageTitle')}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{t('settings.languageDescription')}</Text>
        <LanguagePicker
          value={locale}
          onChange={(nextLocale) => change(nextLocale)}
        />
        <Text style={[styles.meta, { color: colors.muted }]}>{t('settings.languageFallback')} · v{version}{persisted ? '' : ' · appareil'}</Text>
        {message ? <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text> : null}
      </View>
      <MediaDownloadSettingsExperience />
      <CreatorSettingsExperience />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 15, lineHeight: 22 },
  muted: { opacity: 0.5 },
  meta: { fontSize: 12, lineHeight: 18 },
  message: { fontWeight: '800' }
});
