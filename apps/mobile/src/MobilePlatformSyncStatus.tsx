import { KNOWME_EXPERIENCE_REVISION, KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import {
  assessPlatformSync, parsePlatformIdentity, probeErrorMessage,
  type PlatformIdentity
} from './platform-sync-model';

const webOrigin = (process.env.EXPO_PUBLIC_WEB_URL || 'https://knowme-nextech.vercel.app').replace(/\/+$/, '');
const androidCommit = process.env.EXPO_PUBLIC_RELEASE_COMMIT?.trim().toLowerCase() || null;

type ProbeState = {
  version: PlatformIdentity | null;
  error: string;
};

const EMPTY: ProbeState = { version: null, error: '' };

async function probeWeb(): Promise<PlatformIdentity> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 9000);
  try {
    const response = await fetch(webOrigin + '/api/version', {
      method: 'GET', headers: { Accept: 'application/json' },
      cache: 'no-store', signal: abort.signal
    });
    if (!response.ok) {
      const error = new Error('HTTP ' + response.status) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    if (!(response.headers.get('content-type') || '').toLowerCase().includes('json')) {
      throw new Error('le site ne renvoie pas de JSON sur /api/version.');
    }
    return parsePlatformIdentity(await response.json(), 'web');
  } finally {
    clearTimeout(timeout);
  }
}

async function probeApi(): Promise<PlatformIdentity> {
  return parsePlatformIdentity(await apiFetch<unknown>('/platform-sync/version'), 'api');
}

export function MobilePlatformSyncStatus() {
  const { colors } = useAppearance();
  const [web, setWeb] = useState<ProbeState>(EMPTY);
  const [api, setApi] = useState<ProbeState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const check = useCallback(async (active: () => boolean = () => true) => {
    if (active()) {
      setLoading(true);
      setChecked(false);
      setDetailsOpen(false);
      setWeb(EMPTY);
      setApi(EMPTY);
    }
    // Neither failing origin may erase the other origin's valid response.
    const results = await Promise.allSettled([probeWeb(), probeApi()]);
    if (!active()) return;
    const nextWeb = results[0].status === 'fulfilled'
      ? { version: results[0].value, error: '' }
      : { version: null, error: probeErrorMessage('web', results[0].reason) };
    const nextApi = results[1].status === 'fulfilled'
      ? { version: results[1].value, error: '' }
      : { version: null, error: probeErrorMessage('api', results[1].reason) };
    setWeb(nextWeb);
    setApi(nextApi);
    setLoading(false);
    setChecked(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    void check(() => mounted);
    return () => { mounted = false; };
  }, [check]);

  const verdict = assessPlatformSync(
    { version: KNOWME_PRODUCT_VERSION, experienceRevision: KNOWME_EXPERIENCE_REVISION, commit: androidCommit },
    web.version, api.version
  );
  const verdictText = !checked
    ? 'Vérification en cours…'
    : verdict === 'synchronized'
      ? 'Versions, contrat et commits identiques.'
      : verdict === 'unavailable'
        ? 'Synchronisation impossible à vérifier : un service ne répond pas.'
        : verdict === 'unverified'
          ? 'Les versions concordent, mais il manque une identité de build.'
          : 'Versions ou commits différents : mise à jour coordonnée nécessaire.';

  const line = (label: string, item: ProbeState) => (
    <View style={styles.runtime}>
      <Text style={[styles.runtimeLabel, { color: colors.text }]}>{label} :</Text>
      <View style={styles.runtimeDetails}>
        <Text style={{ color: item.version ? colors.text : colors.muted }}>
          {item.version ? item.version.version + ' · ' + (item.version.commit?.slice(0, 8) || 'commit inconnu')
            : loading ? 'vérification…' : 'indisponible'}
        </Text>

      </View>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Versions de KnowMe</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Comparaison de la version, du contrat et du commit de chaque plateforme.
      </Text>
      <View style={styles.runtime}>
        <Text style={[styles.runtimeLabel, { color: colors.text }]}>APK :</Text>
        <Text style={{ color: colors.text }}>{KNOWME_PRODUCT_VERSION} · {androidCommit?.slice(0, 8) || 'commit non identifiable'}</Text>
      </View>
      {line('Web', web)}
      {line('API', api)}
      <View style={styles.status}>
        {loading && <ActivityIndicator color={colors.accent} size="small" />}
        <Text accessibilityRole="text" style={{ color: verdict === 'synchronized' ? colors.accent : colors.danger, fontWeight: '700', flex: 1 }}>
          {verdictText}
        </Text>
      </View>
      {(web.error || api.error) && !loading ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }}
            onPress={() => setDetailsOpen(value => !value)} style={styles.detailsButton}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              {detailsOpen ? 'Masquer les erreurs' : 'Afficher les erreurs'}
            </Text>
          </Pressable>
          {detailsOpen ? (
            <View style={styles.details}>
              {!!web.error && <Text selectable style={[styles.error, { color: colors.danger }]}>{web.error}</Text>}
              {!!api.error && <Text selectable style={[styles.error, { color: colors.danger }]}>{api.error}</Text>}
            </View>
          ) : null}
        </View>
      ) : null}
      <Pressable onPress={() => { if (!loading) void check(); }} disabled={loading}
        accessibilityRole="button" accessibilityLabel="Revérifier les versions Web, API et APK"
        style={[styles.button, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }, loading && styles.disabled]}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Revérifier</Text>
      </Pressable>
      <Text style={[styles.small, { color: colors.muted }]}>
        Une erreur HTTP 404 indique généralement qu'une route n'est pas déployée. Le résultat ne valide pas, à lui seul, les fonctionnalités.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, borderWidth: 1, borderRadius: 20, gap: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  description: { lineHeight: 19, fontSize: 13 },
  runtime: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  runtimeLabel: { fontWeight: '700', minWidth: 40 },
  runtimeDetails: { flex: 1, minWidth: 120, gap: 5 },
  error: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  detailsButton: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  details: { gap: 8, padding: 12, borderRadius: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  button: { minHeight: 48, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  small: { fontSize: 12, lineHeight: 17 }
});
