import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { route?: string; link?: string } | null;
  readAt?: string | null;
  createdAt: string;
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
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  digestMode: 'INSTANT' | 'HOURLY' | 'DAILY' | 'OFF';
  categorySettings: Record<Category, boolean>;
};

type BooleanPreferenceKey =
  | 'masterEnabled'
  | 'realtimeEnabled'
  | 'quietHoursEnabled'
  | 'pushEnabled';

type CenterResponse = {
  preferences: Preferences;
  groups: NotificationGroup[];
  totals: { unread: number; snoozed: number; archived: number };
  policy: { pushProviderConfigured: boolean; rawPushTokensStored: boolean };
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

const BOOLEAN_SETTINGS: Array<{ label: string; key: BooleanPreferenceKey }> = [
  { label: 'Centre actif', key: 'masterEnabled' },
  { label: 'Alertes en direct', key: 'realtimeEnabled' },
  { label: 'Heures calmes', key: 'quietHoursEnabled' },
  { label: 'Push mobile préparé', key: 'pushEnabled' }
];

function idempotencyKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function booleanPreferencePatch(
  key: BooleanPreferenceKey,
  value: boolean
): Partial<Preferences> {
  if (key === 'masterEnabled') return { masterEnabled: value };
  if (key === 'realtimeEnabled') return { realtimeEnabled: value };
  if (key === 'quietHoursEnabled') return { quietHoursEnabled: value };
  return { pushEnabled: value };
}

export function NotificationCenterExperience({ onClose }: { onClose: () => void }) {
  const { colors } = useAppearance();
  const [center, setCenter] = useState<CenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCenter(await apiFetch<CenterResponse>('/notifications/center'));
    } catch (cause) {
      Alert.alert('Notifications indisponibles', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    let active = true;
    let detach: (() => void) | null = null;
    const refresh = () => void load();

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
  }, [load]);

  async function stateGroup(
    group: NotificationGroup,
    action: 'DISMISS' | 'ARCHIVE' | 'SNOOZE'
  ) {
    setBusy(true);
    try {
      await Promise.all(group.notificationIds.map((id) => apiFetch(`/notifications/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          snoozeMinutes: action === 'SNOOZE' ? 60 : undefined,
          idempotencyKey: idempotencyKey(`${action}:${id}`)
        })
      })));
      await load();
    } catch (cause) {
      Alert.alert('Action impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function markRead(group: NotificationGroup) {
    setBusy(true);
    try {
      await Promise.all(group.notificationIds.map((id) =>
        apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
      ));
      await load();
    } catch (cause) {
      Alert.alert('Action impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function patchPreferences(patch: Partial<Preferences>) {
    if (!center) return;
    setBusy(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          ...center.preferences,
          ...patch,
          categorySettings: {
            ...center.preferences.categorySettings,
            ...(patch.categorySettings ?? {}),
            SECURITY: true,
            SYSTEM: true
          }
        })
      });
      await load();
    } catch (cause) {
      Alert.alert('Réglage impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !center) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>CENTRE INTELLIGENT</Text>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          <Text style={{ color: colors.muted }}>
            {center.totals.unread} non lue(s) · {center.totals.snoozed} reportée(s)
          </Text>
        </View>
        <Pressable onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>Fermer</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setSettings((value) => !value)}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>⚙️ Préférences globales</Text>
        <Text style={{ color: colors.muted }}>
          {center.preferences.realtimeEnabled ? 'Temps réel actif' : 'Temps réel coupé'} · {center.preferences.digestMode}
        </Text>
      </Pressable>

      {settings && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {BOOLEAN_SETTINGS.map((setting) => (
            <View key={setting.key} style={styles.settingRow}>
              <Text style={{ color: colors.text }}>{setting.label}</Text>
              <Switch
                disabled={busy || (setting.key === 'pushEnabled' && !center.policy.pushProviderConfigured)}
                value={center.preferences[setting.key]}
                onValueChange={(value) => void patchPreferences(
                  booleanPreferencePatch(setting.key, value)
                )}
              />
            </View>
          ))}
          {CATEGORY_META.map((category) => {
            const locked = category.key === 'SECURITY' || category.key === 'SYSTEM';
            return (
              <View key={category.key} style={styles.settingRow}>
                <Text style={{ color: colors.text }}>{category.icon} {category.label}</Text>
                <Switch
                  disabled={busy || locked}
                  value={center.preferences.categorySettings[category.key]}
                  onValueChange={(value) => void patchPreferences({
                    categorySettings: { ...center.preferences.categorySettings, [category.key]: value }
                  })}
                />
              </View>
            );
          })}
          {!center.policy.pushProviderConfigured && (
            <Text style={{ color: colors.muted, marginTop: 10 }}>
              Aucun fournisseur push n’est encore activé. KnowMe ne stocke pas de jeton brut.
            </Text>
          )}
        </View>
      )}

      {center.groups.length === 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Aucune alerte visible</Text>
          <Text style={{ color: colors.muted }}>Les prochaines interactions autorisées apparaîtront ici.</Text>
        </View>
      )}

      {center.groups.map((group) => {
        const category = CATEGORY_META.find((entry) => entry.key === group.category);
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
              {category?.icon ?? '🔔'} {group.latest.title}{group.grouped ? ` ×${group.count}` : ''}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>{group.latest.body}</Text>
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>
              {new Date(group.latest.createdAt).toLocaleString()} · {group.unreadCount} non lue(s)
            </Text>
            <View style={styles.actions}>
              {group.unreadCount > 0 && (
                <Pressable disabled={busy} onPress={() => void markRead(group)} style={[styles.button, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>Lu</Text>
                </Pressable>
              )}
              <Pressable disabled={busy} onPress={() => void stateGroup(group, 'SNOOZE')} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>1 h</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => void stateGroup(group, 'ARCHIVE')} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Archiver</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => void stateGroup(group, 'DISMISS')} style={[styles.button, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Masquer</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '900', marginVertical: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  button: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }
});
