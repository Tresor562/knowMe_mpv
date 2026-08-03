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

type ServerPreference = MediaDownloadPreference & {
  version: number;
  persisted: boolean;
};

const LABELS: Record<MediaKind, string> = {
  IMAGE: 'Photos', VIDEO: 'Vidéos', AUDIO: 'Audio', FILE: 'Fichiers'
};

export function MediaDownloadSettingsExperience() {
  const { colors } = useAppearance();
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Téléchargements et cache média</Text>
      <Text style={{ color: colors.muted }}>Wi‑Fi, données mobiles et itinérance sont contrôlés séparément.</Text>
      {(['wifiKinds', 'cellularKinds', 'roamingKinds'] as const).map((network) => (
        <View key={network} style={styles.group}>
          <Text style={[styles.label, { color: colors.text }]}>{network === 'wifiKinds' ? 'Wi‑Fi' : network === 'cellularKinds' ? 'Données mobiles' : 'Itinérance'}</Text>
          <View style={styles.wrap}>
            {MEDIA_KINDS.map((kind) => {
              const selected = preference[network].includes(kind);
              return (
                <Pressable key={kind} disabled={busy} onPress={() => toggle(network, kind)} style={[styles.pill, { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.surfaceRaised }]}>
                  <Text style={{ color: selected ? colors.accentText : colors.text, fontWeight: '800' }}>{LABELS[kind]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>Arrière-plan</Text><Switch value={preference.backgroundDownloads} disabled={busy} onValueChange={(value) => void save({ ...preference, backgroundDownloads: value })} /></View>
      <View style={styles.row}><Text style={{ color: colors.text, flex: 1 }}>Respecter l’économie de données</Text><Switch value={preference.respectDataSaver} disabled={busy} onValueChange={(value) => void save({ ...preference, respectDataSaver: value })} /></View>
      <Text style={{ color: colors.muted }}>Quota : {preference.maxCacheMb} Mo · {count} copie(s) · {(bytes / 1024 / 1024).toFixed(1)} Mo utilisés</Text>
      <View style={styles.wrap}>{[128, 512, 1024, 2048].map((value) => <Pressable key={value} disabled={busy} onPress={() => void save({ ...preference, maxCacheMb: value })} style={[styles.pill, { borderColor: colors.border, backgroundColor: preference.maxCacheMb === value ? colors.accent : colors.surfaceRaised }]}><Text style={{ color: preference.maxCacheMb === value ? colors.accentText : colors.text }}>{value} Mo</Text></Pressable>)}</View>
      <Pressable disabled={busy || count === 0} onPress={() => void (async () => { setBusy(true); await clearMobileMediaCache(); setBytes(0); setCount(0); setBusy(false); setMessage('Copies locales supprimées.'); })()} style={[styles.clear, { borderColor: colors.danger }]}><Text style={{ color: colors.danger, fontWeight: '900' }}>Supprimer les copies locales</Text></Pressable>
      {message ? <Text style={{ color: colors.secondary }}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 14 },
  title: { fontSize: 19, fontWeight: '900' },
  group: { gap: 8 },
  label: { fontWeight: '900' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clear: { borderWidth: 1, borderRadius: 15, padding: 12, alignItems: 'center' }
});
