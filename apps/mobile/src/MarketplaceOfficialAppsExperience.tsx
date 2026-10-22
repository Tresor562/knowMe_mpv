import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import {
  marketplaceOfficialAndroidRelease, type MarketplaceOfficialAndroidRelease
} from './marketplace-official-android-release';
import { checkKnowMeUpdateNow } from './updates/MobileUpdateNotice';
import { KnowMeIcon, GlassSurface } from './ui/KnowMeUI';
import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';

type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';

export function MarketplaceOfficialAppsExperience() {
  const { colors, visual } = useAppearance();
  const [release, setRelease] = useState<MarketplaceOfficialAndroidRelease | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await apiFetch<unknown>('/mobile-updates/android');
      const available = marketplaceOfficialAndroidRelease(response);
      setRelease(available);
      setStatus(available ? 'ready' : 'empty');
    } catch {
      setRelease(null);
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checkUpdate = async () => {
    if (checking || !release) return;
    setChecking(true);
    try {
      const result = await checkKnowMeUpdateNow();
      if (result === 'current') {
        Alert.alert('KnowMe est à jour', 'Aucune nouvelle version à installer sur cet appareil.');
      } else if (result === 'unsupported') {
        Alert.alert('Mise à jour indisponible', 'Cet APK ne dispose pas encore de l’installateur intégré. Utilise la mise à jour officielle compatible.');
      } else if (result === 'unavailable') {
        Alert.alert('Connexion impossible', 'Le serveur de mises à jour KnowMe est momentanément indisponible.');
      }
      // The existing root-level update notice displays its own verified
      // consent flow for 'available'; never start a parallel installation.
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Applications KnowMe</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Versions officielles vérifiées par le serveur KnowMe
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les applications"
          disabled={status === 'loading'} onPress={() => void load()}
          style={[styles.iconButton, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="refresh" size={20} color={colors.accent} />
        </Pressable>
      </View>

      <Text style={[styles.description, { color: colors.muted }]}>
        Le catalogue communautaire d’APK n’est pas encore disponible.
        Aucune application externe n’est affichée sans vérification et publication autorisée.
      </Text>

      {status === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Vérification des versions…</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={[styles.stateText, { color: colors.muted }]}>
            Impossible de charger la version officielle.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : !release ? (
        <View style={styles.state}>
          <Text accessibilityRole="text" style={[styles.stateText, { color: colors.muted }]}>
            Aucune nouvelle distribution APK officielle n’est annoncée.
          </Text>
        </View>
      ) : (
        <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.appCard}>
          <View style={styles.appRow}>
            <View style={[styles.appIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="download" size={27} color={colors.accent}/>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={[styles.appName, { color: colors.text }]}>KnowMe Android</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Version {release.version} · Code {release.versionCode}
              </Text>
              <Text style={[styles.verified, { color: colors.accent }]}>Distribution officielle KnowMe</Text>
            </View>
          </View>
          {release.notes.length > 0 ? (
            <Text style={[styles.description, { color: colors.muted }]}>{release.notes}</Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.text }]}>Empreinte SHA-256 de référence</Text>
          <Text selectable style={[styles.digest, { backgroundColor: colors.backgroundAccent, color: colors.muted }]}>
            {release.sha256}
          </Text>
          <Text style={[styles.footnote, { color: colors.muted }]}>
            L’installation reste contrôlée par la mise à jour intégrée de KnowMe et la vérification native Android.
            Aucun fichier ne sera installé sans ton accord.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void checkUpdate()} disabled={checking}
            style={[styles.primary, { backgroundColor: colors.accent, opacity: checking ? 0.7 : 1 }]}>
            <KnowMeIcon name="refresh" size={20} color={colors.accentText}/>
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              {checking ? 'Vérification…' : 'Vérifier la mise à jour'}
            </Text>
          </Pressable>
        </GlassSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 24, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  description: { fontSize: 13, lineHeight: 20 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 155, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 15 },
  stateText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  appCard: { padding: 16, gap: 13 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  appIcon: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 17, fontWeight: '800' },
  verified: { fontSize: 11, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  label: { fontSize: 12, fontWeight: '700' },
  digest: { fontSize: 11, lineHeight: 17, padding: 11, overflow: 'hidden', borderRadius: 12 },
  footnote: { fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderRadius: 16 },
  primaryText: { fontSize: 14, fontWeight: '800' }
});
