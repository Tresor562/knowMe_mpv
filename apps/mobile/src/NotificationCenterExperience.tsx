import { useCallback, useEffect, useRef, useState } from 'react';
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
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { getRealtimeSocket } from './realtime';

type Category =
  | 'SOCIAL'
  | 'MESSAGING'
  | 'CHALLENGES'
  | 'GIFTS'
  | 'SECRET'
  | 'CIRCLES'
  | 'SECURITY'
  | 'SYSTEM';
type CenterView = 'ACTIVE' | 'SNOOZED' | 'ARCHIVED' | 'DISMISSED';
type DigestMode = 'INSTANT' | 'HOURLY' | 'DAILY' | 'CENTER_ONLY';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { route?: string; link?: string } | null;
  readAt?: string | null;
  createdAt: string;
  category: Category;
  critical: boolean;
  state?: { snoozedUntil?: string | null } | null;
};

type NotificationGroup = {
  groupKey: string;
  category: Category;
  count: number;
  unreadCount: number;
  latest: NotificationItem;
  notificationIds: string[];
  grouped: boolean;
};

type Preferences = {
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  quietHoursEnabled: boolean;
  digestMode: DigestMode;
  dailyDigestMinute: number;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Record<Category, boolean>;
  mutedTypes: string[];
  mutedCircleIds: string[];
};

type CenterResponse = {
  preferences: Preferences;
  view: CenterView;
  groups: NotificationGroup[];
  nextCursor?: string | null;
  totals: {
    unread: number;
    snoozed: number;
    archived: number;
    dismissed: number;
  };
  policy: {
    transportsOwnedBy: string;
    rawTransportSecretsExposed: false;
  };
};

const CATEGORY_META: Array<{ key: Category; label: string; icon: string }> = [
  { key: 'SOCIAL', label: 'Social', icon: '👥' },
  { key: 'MESSAGING', label: 'Messages', icon: '💬' },
  { key: 'CHALLENGES', label: 'Défis et jeux', icon: '🎯' },
  { key: 'GIFTS', label: 'Cadeaux', icon: '🎁' },
  { key: 'SECRET', label: 'Secret', icon: '🕵️' },
  { key: 'CIRCLES', label: 'Profils collectifs', icon: '⭐' },
  { key: 'SECURITY', label: 'Sécurité', icon: '🛡️' },
  { key: 'SYSTEM', label: 'Système', icon: '⚙️' }
];

const VIEWS: Array<{ key: CenterView; label: string }> = [
  { key: 'ACTIVE', label: 'Actives' },
  { key: 'SNOOZED', label: 'Reportées' },
  { key: 'ARCHIVED', label: 'Archivées' },
  { key: 'DISMISSED', label: 'Masquées' }
];

const MODES: Array<{ key: DigestMode; label: string }> = [
  { key: 'INSTANT', label: 'Instantané' },
  { key: 'HOURLY', label: 'Horaire' },
  { key: 'DAILY', label: 'Quotidien' },
  { key: 'CENTER_ONLY', label: 'Centre' }
];

function idempotencyKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function minuteToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(
    value % 60
  ).padStart(2, '0')}`;
}

function timeToMinute(value: string) {
  const [hour = Number.NaN, minute = Number.NaN] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function mergeGroups(current: NotificationGroup[], incoming: NotificationGroup[]) {
  const byKey = new Map(current.map((group) => [group.groupKey, group]));
  for (const group of incoming) {
    const previous = byKey.get(group.groupKey);
    if (!previous) {
      byKey.set(group.groupKey, group);
      continue;
    }
    const notificationIds = [
      ...new Set([...previous.notificationIds, ...group.notificationIds])
    ];
    byKey.set(group.groupKey, {
      ...group,
      notificationIds,
      count: notificationIds.length,
      unreadCount: Math.min(
        notificationIds.length,
        previous.unreadCount + group.unreadCount
      ),
      grouped: notificationIds.length > 1,
      latest:
        new Date(previous.latest.createdAt).getTime() >
        new Date(group.latest.createdAt).getTime()
          ? previous.latest
          : group.latest
    });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      new Date(right.latest.createdAt).getTime() -
      new Date(left.latest.createdAt).getTime()
  );
}

export function NotificationCenterExperience({
  onClose,
  onOpenRoute
}: {
  onClose: () => void;
  onOpenRoute?: (route: string) => void;
}) {
  const { colors } = useAppearance();
  const cursorRef = useRef<string | null>(null);
  const [center, setCenter] = useState<CenterResponse | null>(null);
  const [view, setView] = useState<CenterView>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dailyTime, setDailyTime] = useState('08:00');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [timezone, setTimezone] = useState('UTC');

  const load = useCallback(
    async (append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const query = new URLSearchParams({ view, limit: '50' });
        if (append && cursorRef.current) {
          query.set('cursor', cursorRef.current);
        }
        const value = await apiFetch<CenterResponse>(
          `/notifications/center?${query.toString()}`
        );
        cursorRef.current = value.nextCursor ?? null;
        setCenter((current) =>
          append && current && current.view === value.view
            ? {
                ...value,
                groups: mergeGroups(current.groups, value.groups)
              }
            : value
        );
        setDailyTime(minuteToTime(value.preferences.dailyDigestMinute));
        setQuietStart(minuteToTime(value.preferences.quietStartMinute));
        setQuietEnd(minuteToTime(value.preferences.quietEndMinute));
        setTimezone(value.preferences.timezone);
      } catch (cause) {
        Alert.alert(
          'Notifications indisponibles',
          cause instanceof Error ? cause.message : 'Réessaie.'
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [view]
  );

  useEffect(() => {
    cursorRef.current = null;
    setCenter(null);
    void load(false);
  }, [load]);

  useEffect(() => {
    let active = true;
    let detach: (() => void) | null = null;
    const refresh = () => {
      if (view === 'ACTIVE') {
        cursorRef.current = null;
        void load(false);
      }
    };
    void getRealtimeSocket().then((socket) => {
      if (!active || !socket) return;
      socket.on('notification:created', refresh);
      socket.on('notification:read', refresh);
      socket.on('notification:read-all', refresh);
      detach = () => {
        socket.off('notification:created', refresh);
        socket.off('notification:read', refresh);
        socket.off('notification:read-all', refresh);
      };
    });
    return () => {
      active = false;
      detach?.();
    };
  }, [load, view]);

  async function stateGroup(
    group: NotificationGroup,
    action: 'DISMISS' | 'ARCHIVE' | 'SNOOZE' | 'RESTORE'
  ) {
    setBusy(true);
    try {
      await Promise.all(
        group.notificationIds.map((id) =>
          apiFetch(`/notifications/${id}/state`, {
            method: 'POST',
            body: JSON.stringify({
              action,
              snoozeMinutes: action === 'SNOOZE' ? 60 : undefined,
              idempotencyKey: idempotencyKey(`${action}:${id}`)
            })
          })
        )
      );
      cursorRef.current = null;
      await load(false);
    } catch (cause) {
      Alert.alert(
        'Action impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function markRead(group: NotificationGroup) {
    setBusy(true);
    try {
      await Promise.all(
        group.notificationIds.map((id) =>
          apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
        )
      );
      const route = group.latest.data?.route ?? group.latest.data?.link;
      if (route && onOpenRoute) onOpenRoute(route);
      else {
        cursorRef.current = null;
        await load(false);
      }
    } catch (cause) {
      Alert.alert(
        'Action impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function patchPreferences(patch: Partial<Preferences>) {
    if (!center) return;
    setBusy(true);
    try {
      const next: Preferences = {
        ...center.preferences,
        ...patch,
        categorySettings: {
          ...center.preferences.categorySettings,
          ...(patch.categorySettings ?? {}),
          SECURITY: true,
          SYSTEM: true
        }
      };
      await apiFetch('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(next)
      });
      cursorRef.current = null;
      await load(false);
    } catch (cause) {
      Alert.alert(
        'Réglage impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTimes() {
    const dailyDigestMinute = timeToMinute(dailyTime);
    const quietStartMinute = timeToMinute(quietStart);
    const quietEndMinute = timeToMinute(quietEnd);
    if (
      dailyDigestMinute === null ||
      quietStartMinute === null ||
      quietEndMinute === null ||
      !timezone.trim()
    ) {
      Alert.alert(
        'Horaire invalide',
        'Utilise le format HH:MM et un fuseau IANA.'
      );
      return;
    }
    await patchPreferences({
      dailyDigestMinute,
      quietStartMinute,
      quietEndMinute,
      timezone: timezone.trim()
    });
  }

  if (loading || !center) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            CENTRE INTELLIGENT
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          <Text style={{ color: colors.muted }}>
            {center.totals.unread} non lue(s) · {center.totals.snoozed}{' '}
            reportée(s)
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.button, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text }}>Fermer</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {VIEWS.map((candidate) => (
            <Pressable
              accessibilityRole="button"
              key={candidate.key}
              onPress={() => setView(candidate.key)}
              style={[
                styles.pill,
                {
                  borderColor: colors.border,
                  backgroundColor:
                    candidate.key === view ? colors.accent : colors.surface
                }
              ]}
            >
              <Text
                style={{
                  color:
                    candidate.key === view ? colors.background : colors.text,
                  fontWeight: '800'
                }}
              >
                {candidate.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => setSettings((value) => !value)}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          ⚙️ Préférences globales
        </Text>
        <Text style={{ color: colors.muted }}>
          {center.preferences.realtimeEnabled
            ? 'Temps réel actif'
            : 'Temps réel coupé'}{' '}
          · {center.preferences.digestMode}
        </Text>
      </Pressable>

      {settings && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
        >
          {(
            [
              ['Centre actif', 'masterEnabled'],
              ['Alertes en direct', 'realtimeEnabled'],
              ['Heures calmes', 'quietHoursEnabled']
            ] as const
          ).map(([label, key]) => (
            <View key={key} style={styles.settingRow}>
              <Text style={{ color: colors.text }}>{label}</Text>
              <Switch
                disabled={busy}
                value={center.preferences[key]}
                onValueChange={(value) =>
                  void patchPreferences({ [key]: value } as Partial<Preferences>)
                }
              />
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mode</Text>
          <View style={styles.rowWrap}>
            {MODES.map((mode) => (
              <Pressable
                key={mode.key}
                disabled={busy}
                onPress={() => void patchPreferences({ digestMode: mode.key })}
                style={[
                  styles.pill,
                  {
                    borderColor: colors.border,
                    backgroundColor:
                      center.preferences.digestMode === mode.key
                        ? colors.accent
                        : colors.background
                  }
                ]}
              >
                <Text
                  style={{
                    color:
                      center.preferences.digestMode === mode.key
                        ? colors.background
                        : colors.text
                  }}
                >
                  {mode.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Horaires</Text>
          <TextInput
            accessibilityLabel="Heure du résumé quotidien"
            value={dailyTime}
            onChangeText={setDailyTime}
            placeholder="08:00"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            accessibilityLabel="Début des heures calmes"
            value={quietStart}
            onChangeText={setQuietStart}
            placeholder="22:00"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            accessibilityLabel="Fin des heures calmes"
            value={quietEnd}
            onChangeText={setQuietEnd}
            placeholder="07:00"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            accessibilityLabel="Fuseau horaire"
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
            placeholder="Africa/Porto-Novo"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void saveTimes()}
            style={[styles.button, { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '800' }}>
              Enregistrer les horaires
            </Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Catégories
          </Text>
          {CATEGORY_META.map((category) => {
            const locked =
              category.key === 'SECURITY' || category.key === 'SYSTEM';
            return (
              <View key={category.key} style={styles.settingRow}>
                <Text style={{ color: colors.text }}>
                  {category.icon} {category.label}
                  {locked ? ' · essentiel' : ''}
                </Text>
                <Switch
                  disabled={busy || locked}
                  value={center.preferences.categorySettings[category.key]}
                  onValueChange={(value) =>
                    void patchPreferences({
                      categorySettings: {
                        ...center.preferences.categorySettings,
                        [category.key]: value
                      }
                    })
                  }
                />
              </View>
            );
          })}
          <Text style={{ color: colors.muted, marginTop: 10 }}>
            Les endpoints chiffrés et fournisseurs restent gérés par{' '}
            {center.policy.transportsOwnedBy}. Aucun secret n’est renvoyé.
          </Text>
        </View>
      )}

      {center.groups.length === 0 && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Aucune alerte dans cette vue
          </Text>
          <Text style={{ color: colors.muted }}>
            Les événements d’origine restent conservés pour l’audit.
          </Text>
        </View>
      )}

      {center.groups.map((group) => {
        const category = CATEGORY_META.find(
          (entry) => entry.key === group.category
        );
        return (
          <View
            key={group.groupKey}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: group.unreadCount ? colors.accent : colors.border
              }
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {category?.icon ?? '🔔'} {group.latest.title}
              {group.grouped ? ` ×${group.count}` : ''}
              {group.latest.critical ? ' · essentiel' : ''}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              {group.latest.body}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>
              {new Date(group.latest.createdAt).toLocaleString()} ·{' '}
              {group.unreadCount} non lue(s)
            </Text>
            {group.latest.state?.snoozedUntil && (
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Jusqu’au{' '}
                {new Date(group.latest.state.snoozedUntil).toLocaleString()}
              </Text>
            )}
            <View style={styles.actions}>
              {view === 'ACTIVE' && group.unreadCount > 0 && (
                <Pressable
                  disabled={busy}
                  onPress={() => void markRead(group)}
                  style={[styles.button, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text }}>Ouvrir / lu</Text>
                </Pressable>
              )}
              {view === 'ACTIVE' && !group.latest.critical && (
                <>
                  <Pressable
                    disabled={busy}
                    onPress={() => void stateGroup(group, 'SNOOZE')}
                    style={[styles.button, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text }}>1 h</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void stateGroup(group, 'ARCHIVE')}
                    style={[styles.button, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text }}>Archiver</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void stateGroup(group, 'DISMISS')}
                    style={[styles.button, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text }}>Masquer</Text>
                  </Pressable>
                </>
              )}
              {view !== 'ACTIVE' && (
                <Pressable
                  disabled={busy}
                  onPress={() => void stateGroup(group, 'RESTORE')}
                  style={[styles.button, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accent }}>Restaurer</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {center.nextCursor && (
        <Pressable
          accessibilityRole="button"
          disabled={loadingMore || busy}
          onPress={() => void load(true)}
          style={[styles.button, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text }}>
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '900', marginVertical: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  row: { flexDirection: 'row', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center'
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  }
});
