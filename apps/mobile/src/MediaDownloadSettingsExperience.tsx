import {
  MEDIA_KINDS,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference,
  type MediaKind
} from '@knowme/media-cache-contract';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { apiFetch, type ApiError } from './api';
import { useAppearance } from './AppearanceProvider';
import { clearMobileMediaCache, mobileMediaCacheStats } from './media-cache';
import { KnowMeIcon, SoftSurface } from './ui/KnowMeUI';

type ServerPreference = MediaDownloadPreference & {
  version: number;
  persisted: boolean;
};

const LABELS: Record<MediaKind, string> = {
  IMAGE: 'Photos', VIDEO: 'Vidéos', AUDIO: 'Audio', FILE: 'Fichiers'
};

export function MediaDownloadSettingsExperience() {
  const { colors, visual } = useAppearance();
  const [preference, setPreference] = useState<ServerPreference | null>(null);
  const [bytes, setBytes] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [server, stats] = await Promise.all([
      apiFetch<ServerPreference>('/media/download-preferences'),
      mobileMediaCacheStats().catch(() => ({ bytes: 0, count: 0, entries: [] }))
    ]);
    setPreference(server);
    setBytes(stats.bytes);
    setCount(stats.count);
  }

  useEffect(() => { void refresh().catch(() => setMessage('Chargement impossible.')); }, []);

  async function save(next: MediaDownloadPreference) {
    if (!preference || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await apiFetch<ServerPreference>('/media/download-preferences', {
        method: 'PUT',
        body: JSON.stringify({ ...normalizeMediaDownloadPreference(next), expectedVersion: preference.version })
      });
      setPreference(saved);
      setMessage('Préférences synchronisées.');
    } catch (cause) {
      if ((cause as ApiError)?.code === 'MEDIA_DOWNLOAD_VERSION_CONFLICT') await refresh().catch(() => undefined);
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function clearCache() {
    if (busy || count === 0) return;
    setBusy(true);
    setMessage('');
    try {
      await clearMobileMediaCache();
      setBytes(0);
      setCount(0);
      setMessage('Cache local supprimé. Les médias distants restent disponibles.');
    } catch {
      setMessage('Impossible de vider le cache local.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(network: 'wifiKinds' | 'cellularKinds' | 'roamingKinds', kind: MediaKind) {
    if (!preference) return;
    const current = preference[network];
    const next = current.includes(kind)
      ? current.filter((item) => item !== kind)
      : MEDIA_KINDS.filter((item) => [...current, kind].includes(item));
    void save({ ...preference, [network]: next });
  }

  if (!preference) return null;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="settings" size={20} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Téléchargements & stockage</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Choisis ce que KnowMe peut télécharger selon le réseau.
          </Text>
        </View>
      </View>
      {(['wifiKinds', 'cellularKinds', 'roamingKinds'] as const).map((network) => (
        <View key={network} style={styles.group}>
          <Text style={[styles.label, { color: colors.text }]}>{network === 'wifiKinds' ? 'Wi‑Fi' : network === 'cellularKinds' ? 'Données mobiles' : 'Itinérance'}</Text>
          <View style={styles.wrap}>
            {MEDIA_KINDS.map((kind) => {
              const selected = preference[network].includes(kind);
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  hitSlop={4}
                  disabled={busy}
                  onPress={() => toggle(network, kind)}
                  style={[
                    styles.pill,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accent : colors.surface
                    }
                  ]}
                >
                  <Text style={[styles.pillText, { color: selected ? colors.accentText : colors.text }]}>
                    {LABELS[kind]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>Arrière-plan</Text><Switch trackColor={{ false: colors.backgroundAccent, true: colors.accent }} thumbColor={colors.surface} value={preference.backgroundDownloads} disabled={busy} onValueChange={(value) => void save({ ...preference, backgroundDownloads: value })} /></View>
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>Respecter l’économie de données</Text><Switch trackColor={{ false: colors.backgroundAccent, true: colors.accent }} thumbColor={colors.surface} value={preference.respectDataSaver} disabled={busy} onValueChange={(value) => void save({ ...preference, respectDataSaver: value })} /></View>
      <SoftSurface style={styles.cacheSummary}>
        <View>
          <Text style={[styles.cacheValue, { color: colors.text }]}>{(bytes / 1024 / 1024).toFixed(1)} Mo</Text>
          <Text style={[styles.cacheLabel, { color: colors.muted }]}>utilisés</Text>
        </View>
        <View>
          <Text style={[styles.cacheValue, { color: colors.text }]}>{count}</Text>
          <Text style={[styles.cacheLabel, { color: colors.muted }]}>copies locales</Text>
        </View>
        <View>
          <Text style={[styles.cacheValue, { color: colors.text }]}>{preference.maxCacheMb} Mo</Text>
          <Text style={[styles.cacheLabel, { color: colors.muted }]}>limite</Text>
        </View>
      </SoftSurface>
      <View style={styles.wrap}>{[128, 512, 1024, 2048].map((value) => <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityState={{ selected: preference.maxCacheMb === value, disabled: busy }}
        hitSlop={4}
        disabled={busy}
        onPress={() => void save({ ...preference, maxCacheMb: value })}
        style={[
          styles.pill,
          {
            borderColor: preference.maxCacheMb === value ? colors.accent : colors.border,
            backgroundColor: preference.maxCacheMb === value ? colors.accent : colors.surface
          }
        ]}
      >
        <Text style={[styles.pillText, { color: preference.maxCacheMb === value ? colors.accentText : colors.text }]}>
          {value} Mo
        </Text>
      </Pressable>)}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vider le cache local"
        accessibilityState={{ disabled: busy || count === 0 }}
        disabled={busy || count === 0}
        onPress={() => void clearCache()}
        style={[
          styles.clear,
          { borderColor: colors.danger, borderRadius: visual.controlRadius },
          (busy || count === 0) && styles.disabled
        ]}
      >
        <Text style={[styles.clearText, { color: colors.danger }]}>Vider le cache local</Text>
      </Pressable>
      <Text style={[styles.cacheHint, { color: colors.muted }]}>
        Vider le cache supprime uniquement les copies présentes sur cet appareil, pas les médias stockés à distance.
      </Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.secondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 13 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 12.5, lineHeight: 18 },
  group: { gap: 7 },
  label: { fontSize: 13.5, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillText: { fontSize: 12.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth },
  cacheSummary: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cacheValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cacheLabel: { fontSize: 10, marginTop: 1, textAlign: 'center' },
  clear: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 13.5, fontWeight: '700' },
  cacheHint: { fontSize: 11.5, lineHeight: 17 },
  message: { fontSize: 12.5, lineHeight: 18 },
  disabled: { opacity: 0.45 }
});
