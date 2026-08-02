import { useCallback, useEffect, useState } from 'react';
import {
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

function ActionButton({ title, onPress, disabled = false, secondary = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.mutedButton
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

export function PrivacyExperience() {
  const [center, setCenter] = useState<PrivacyCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requestType, setRequestType] = useState('EXPORT');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setCenter(await apiFetch<PrivacyCenter>('/privacy/center?locale=fr'));
    } catch (cause) {
      Alert.alert('Confidentialité indisponible', errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

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
          source: 'ANDROID',
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
    return <View style={styles.card}><Text style={styles.muted}>Chargement de la confidentialité…</Text></View>;
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
    <ScrollView contentContainerStyle={styles.content} nestedScrollEnabled>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONFIDENTIALITÉ</Text>
        <Text style={styles.heading}>Mes données, mes choix</Text>
        <Text style={styles.description}>
          Les choix sont enregistrés par le serveur avec la version exacte de chaque politique.
        </Text>
      </View>

      {center.policies.map((policy) => (
        <View key={`${policy.key}-${policy.version}`} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{policy.title}</Text>
            <Text style={policy.granted ? styles.active : styles.warning}>
              {policy.granted ? 'Acceptée' : policy.required ? 'Requise' : 'Facultative'}
            </Text>
          </View>
          <Text style={styles.description}>{policy.summary}</Text>
          <Text style={styles.muted}>
            Version {policy.version} · {new Date(policy.effectiveAt).toLocaleDateString('fr-FR')}
          </Text>
          {!policy.granted ? (
            <ActionButton title="Accepter cette version" disabled={busy} onPress={() => void decide(policy, 'GRANT')} />
          ) : !policy.required ? (
            <ActionButton title="Retirer mon consentement" secondary disabled={busy} onPress={() => void decide(policy, 'WITHDRAW')} />
          ) : null}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visibilité du profil</Text>
        <View style={styles.segmentRow}>
          {(['PRIVATE', 'FRIENDS', 'PUBLIC'] as const).map((value) => (
            <Pressable
              key={value}
              disabled={busy}
              onPress={() => void updatePreference('profileVisibility', value)}
              style={[
                styles.segment,
                center.preferences.profileVisibility === value && styles.segmentActive
              ]}
            >
              <Text style={center.preferences.profileVisibility === value ? styles.segmentActiveText : styles.muted}>
                {value === 'PRIVATE' ? 'Privé' : value === 'FRIENDS' ? 'Amis' : 'Public'}
              </Text>
            </Pressable>
          ))}
        </View>
        {toggles.map(([field, title, description]) => (
          <View key={field} style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.label}>{title}</Text>
              <Text style={styles.muted}>{description}</Text>
            </View>
            <Switch
              disabled={busy}
              value={Boolean(center.preferences[field])}
              onValueChange={(value) => void updatePreference(field, value)}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exercer mes droits</Text>
        <View style={styles.segmentRow}>
          {['EXPORT', 'CORRECT', 'RESTRICT', 'OBJECT', 'DELETE'].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRequestType(value)}
              style={[styles.requestChip, requestType === value && styles.segmentActive]}
            >
              <Text style={requestType === value ? styles.segmentActiveText : styles.muted}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={1000}
          multiline
          placeholder="Précision facultative"
          placeholderTextColor="#789187"
          style={styles.input}
        />
        <ActionButton title="Créer la demande" disabled={busy} onPress={() => void createRequest()} />
      </View>

      {center.requests.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{item.type}</Text>
            <Text style={styles.active}>{item.status}</Text>
          </View>
          <Text style={styles.muted}>
            Créée le {new Date(item.requestedAt).toLocaleString('fr-FR')} · échéance {new Date(item.dueAt).toLocaleDateString('fr-FR')}
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
  content: { gap: 14, paddingBottom: 20 },
  header: { gap: 7 },
  eyebrow: { color: '#45e6bd', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  heading: { color: '#f4fff9', fontSize: 24, fontWeight: '900' },
  description: { color: '#b6c8c0', fontSize: 14, lineHeight: 20 },
  muted: { color: '#789187', fontSize: 12, lineHeight: 18 },
  active: { color: '#45e6bd', fontWeight: '900', fontSize: 12 },
  warning: { color: '#ff9d66', fontWeight: '900', fontSize: 12 },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 22, padding: 17, gap: 12 },
  cardTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '900', flexShrink: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  button: { backgroundColor: '#45e6bd', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#45e6bd', borderWidth: 1 },
  buttonText: { color: '#052017', fontWeight: '900' },
  secondaryButtonText: { color: '#45e6bd' },
  mutedButton: { opacity: 0.45 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flex: 1, minWidth: 80, borderColor: '#25473b', borderWidth: 1, borderRadius: 13, paddingVertical: 10, alignItems: 'center' },
  requestChip: { borderColor: '#25473b', borderWidth: 1, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 11 },
  segmentActive: { borderColor: '#45e6bd', backgroundColor: 'rgba(69,230,189,0.1)' },
  segmentActiveText: { color: '#45e6bd', fontWeight: '900', fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopColor: '#1c3a31', borderTopWidth: 1, paddingTop: 12 },
  toggleCopy: { flex: 1, gap: 3 },
  label: { color: '#f4fff9', fontWeight: '800' },
  input: { minHeight: 86, backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 15, color: '#f4fff9', padding: 13, textAlignVertical: 'top' }
});
