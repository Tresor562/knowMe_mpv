import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
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
import { useI18n } from './I18nProvider';
import { KnowMeIcon } from './ui/KnowMeUI';

type Policy = {
  id: string;
  key: string;
  version: number;
  locale: string;
  title: string;
  summary: string;
  required: boolean;
  granted: boolean;
  effectiveAt: string;
};

type Preferences = {
  profileVisibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  discoverability: boolean;
  personalizedRecommendations: boolean;
  analytics: boolean;
  marketing: boolean;
  readReceipts: boolean;
  activityStatus: boolean;
  version: number;
};

type PrivacyRequest = {
  id: string;
  type: string;
  status: string;
  requestedAt: string;
  dueAt: string;
};

type PrivacyCenter = {
  policies: Policy[];
  preferences: Preferences;
  requests: PrivacyRequest[];
};

function requestKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Une erreur est survenue.';
}

function requestTypeLabel(value: string, locale: string) {
  const french: Record<string, string> = {
    EXPORT: 'Exporter mes données',
    CORRECT: 'Corriger mes données',
    RESTRICT: 'Limiter le traitement',
    OBJECT: 'M’opposer',
    DELETE: 'Supprimer mes données'
  };
  const english: Record<string, string> = {
    EXPORT: 'Export my data',
    CORRECT: 'Correct my data',
    RESTRICT: 'Restrict processing',
    OBJECT: 'Object',
    DELETE: 'Delete my data'
  };
  return (locale.startsWith('fr') ? french : english)[value] ?? value;
}

function requestStatusLabel(value: string, locale: string) {
  const french: Record<string, string> = {
    PENDING: 'En cours',
    COMPLETED: 'Terminée',
    CANCELLED: 'Annulée',
    REJECTED: 'Refusée'
  };
  const english: Record<string, string> = {
    PENDING: 'Pending',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected'
  };
  return (locale.startsWith('fr') ? french : english)[value] ?? value;
}

function ActionButton({ title, onPress, disabled = false, secondary = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const { colors, visual } = useAppearance();
  const { locale } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: visual.controlRadius,
          backgroundColor: secondary ? 'transparent' : colors.accent,
          borderColor: colors.accent
        },
        secondary && { borderWidth: 1 },
        (pressed || disabled) && styles.mutedButton
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? colors.accent : colors.accentText }]}>{title}</Text>
    </Pressable>
  );
}

export function PrivacyExperience() {
  const { colors, visual } = useAppearance();
  const [center, setCenter] = useState<PrivacyCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requestType, setRequestType] = useState('EXPORT');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setCenter(await apiFetch<PrivacyCenter>(`/privacy/center?locale=${encodeURIComponent(locale)}`));
    } catch (cause) {
      Alert.alert('Confidentialité indisponible', errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(policy: Policy, action: 'GRANT' | 'WITHDRAW') {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch('/privacy/consents', {
        method: 'POST',
        body: JSON.stringify({
          policyKey: policy.key,
          policyVersion: policy.version,
          locale: policy.locale,
          action,
          source: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'web' ? 'WEB' : 'ANDROID',
          idempotencyKey: requestKey(`consent-${policy.key}`)
        })
      });
      await load();
    } catch (cause) {
      Alert.alert('Décision impossible', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(field: keyof Preferences, value: boolean | string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch('/privacy/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value })
      });
      await load();
    } catch (cause) {
      Alert.alert('Mise à jour impossible', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createRequest() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch('/privacy/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: requestType,
          reason: reason.trim() || undefined,
          idempotencyKey: requestKey(`request-${requestType.toLowerCase()}`)
        })
      });
      setReason('');
      await load();
      Alert.alert('Demande enregistrée', 'KnowMe a enregistré ta demande et son échéance.');
    } catch (cause) {
      Alert.alert('Demande impossible', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/privacy/requests/${id}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      Alert.alert('Annulation impossible', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !center) {
    return <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.cardRadius }]}><Text style={[styles.muted, { color: colors.muted }]}>Chargement de la confidentialité…</Text></View>;
  }

  const toggles: Array<[keyof Preferences, string, string]> = [
    ['discoverability', 'Découverte du profil', 'Apparaître dans les recherches et suggestions autorisées.'],
    ['personalizedRecommendations', 'Recommandations', 'Personnaliser les défis et contenus proposés.'],
    ['analytics', 'Analytics facultatives', 'Aider KnowMe avec des mesures d’usage minimisées.'],
    ['marketing', 'Informations commerciales', 'Recevoir les offres et nouveautés commerciales.'],
    ['readReceipts', 'Accusés de lecture', 'Partager l’état de lecture avec les contacts autorisés.'],
    ['activityStatus', 'Présence', 'Partager ton activité avec les personnes autorisées.']
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="settings" size={20} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.heading, { color: colors.text }]}>Confidentialité</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Choisis ce que tu partages et comment tes données sont utilisées.
          </Text>
        </View>
      </View>

      {center.policies.map((policy) => (
        <View key={`${policy.key}-${policy.version}`} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{policy.title}</Text>
            <Text style={[policy.granted ? styles.active : styles.warning, { color: policy.granted ? colors.accent : colors.danger }]}>
              {policy.granted ? 'Acceptée' : policy.required ? 'Requise' : 'Facultative'}
            </Text>
          </View>
          <Text style={[styles.description, { color: colors.muted }]}>{policy.summary}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            En vigueur depuis {new Date(policy.effectiveAt).toLocaleDateString(locale)}
          </Text>
          {!policy.granted ? (
            <ActionButton title="Accepter cette version" disabled={busy} onPress={() => void decide(policy, 'GRANT')} />
          ) : !policy.required ? (
            <ActionButton title="Retirer mon consentement" secondary disabled={busy} onPress={() => void decide(policy, 'WITHDRAW')} />
          ) : null}
        </View>
      ))}

      <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Visibilité du profil</Text>
        <View style={styles.segmentRow}>
          {(['PRIVATE', 'FRIENDS', 'PUBLIC'] as const).map((value) => (
            <Pressable
              key={value}
              disabled={busy}
              onPress={() => void updatePreference('profileVisibility', value)}
              style={[
                styles.segment,
                {
                  borderColor: center.preferences.profileVisibility === value ? colors.accent : colors.border,
                  backgroundColor: center.preferences.profileVisibility === value ? colors.backgroundAccent : colors.surfaceRaised,
                  borderRadius: visual.controlRadius
                }
              ]}
            >
              <Text style={[
                center.preferences.profileVisibility === value ? styles.segmentActiveText : styles.muted,
                { color: center.preferences.profileVisibility === value ? colors.accent : colors.muted }
              ]}>
                {value === 'PRIVATE' ? 'Privé' : value === 'FRIENDS' ? 'Amis' : 'Public'}
              </Text>
            </Pressable>
          ))}
        </View>
        {toggles.map(([field, title, description]) => (
          <View key={field} style={[styles.toggleRow, { borderTopColor: colors.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{description}</Text>
            </View>
            <Switch
              disabled={busy}
              trackColor={{ false: colors.backgroundAccent, true: colors.accent }}
              thumbColor={colors.surface}
              value={Boolean(center.preferences[field])}
              onValueChange={(value) => void updatePreference(field, value)}
            />
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Exercer mes droits</Text>
        <View style={styles.segmentRow}>
          {['EXPORT', 'CORRECT', 'RESTRICT', 'OBJECT', 'DELETE'].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRequestType(value)}
              style={[
                styles.requestChip,
                {
                  borderColor: requestType === value ? colors.accent : colors.border,
                  backgroundColor: requestType === value ? colors.backgroundAccent : colors.surfaceRaised,
                  borderRadius: visual.controlRadius
                }
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  requestType === value ? styles.segmentActiveText : styles.muted,
                  { color: requestType === value ? colors.accent : colors.muted }
                ]}
              >
                {requestTypeLabel(value, locale)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={1000}
          multiline
          placeholder="Précision facultative"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={[
            styles.input,
            {
              backgroundColor: colors.backgroundAccent,
              borderColor: colors.border,
              color: colors.text,
              borderRadius: visual.inputRadius
            }
          ]}
        />
        <ActionButton title="Créer la demande" disabled={busy} onPress={() => void createRequest()} />
      </View>

      {center.requests.map((item) => (
        <View key={item.id} style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{requestTypeLabel(item.type, locale)}</Text>
            <Text style={[styles.active, { color: colors.accent }]}>{requestStatusLabel(item.status, locale)}</Text>
          </View>
          <Text style={[styles.muted, { color: colors.muted }]}>
            {new Date(item.requestedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} · échéance {new Date(item.dueAt).toLocaleDateString(locale)}
          </Text>
          {item.status === 'PENDING' ? (
            <ActionButton title="Annuler la demande" secondary disabled={busy} onPress={() => void cancelRequest(item.id)} />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 11, paddingBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heading: { fontSize: 19, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  muted: { fontSize: 12, lineHeight: 18 },
  active: { fontWeight: '800', fontSize: 11 },
  warning: { fontWeight: '800', fontSize: 11 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  button: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '800' },
  mutedButton: { opacity: 0.45 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flex: 1, minWidth: 80, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 9, alignItems: 'center' },
  requestChip: { borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 10, maxWidth: '100%' },
  segmentActive: {},
  segmentActiveText: { fontWeight: '800', fontSize: 11 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11 },
  toggleCopy: { flex: 1, gap: 3 },
  label: { fontWeight: '800' },
  input: { minHeight: 78, borderWidth: StyleSheet.hairlineWidth, padding: 12, textAlignVertical: 'top' }
});
