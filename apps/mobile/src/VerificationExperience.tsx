import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { MobileUser } from './ProfileExperience';

type Evidence = {
  id: string;
  type: string;
  provider: string;
  opaqueReference: string;
  digest: string;
};
type Decision = {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
};
type VerificationRequest = {
  id: string;
  submissionNumber: number;
  status: string;
  evidenceCount: number;
  submittedAt: string;
  expiresAt?: string | null;
  decisionReason?: string | null;
  evidence: Evidence[];
  decisions: Decision[];
};

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function Button({
  title,
  onPress,
  disabled = false,
  secondary = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.mutedButton
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function VerificationExperience({
  user,
  onBack,
  onUpdated
}: {
  user: MobileUser;
  onBack: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [displayNameClaim, setDisplayNameClaim] = useState(user.displayName);
  const [countryCode, setCountryCode] = useState('');
  const [provider, setProvider] = useState('KYC_PROVIDER');
  const [opaqueReference, setOpaqueReference] = useState('');
  const [digest, setDigest] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await apiFetch<VerificationRequest[]>('/verification/me'));
    } catch (cause) {
      Alert.alert('Chargement impossible', message(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (busy) return;
    if (!/^[a-fA-F0-9]{64}$/.test(digest.trim())) {
      Alert.alert(
        'Empreinte invalide',
        'L’empreinte SHA-256 doit contenir exactement 64 caractères hexadécimaux.'
      );
      return;
    }
    if (!/^[A-Za-z0-9_]{2,32}$/.test(provider.trim())) {
      Alert.alert('Prestataire invalide', 'Utilise 2 à 32 lettres, chiffres ou underscores.');
      return;
    }
    if (opaqueReference.trim().length < 8) {
      Alert.alert('Référence invalide', 'La référence opaque doit contenir au moins 8 caractères.');
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/verification/requests', {
        method: 'POST',
        body: JSON.stringify({
          displayNameClaim: displayNameClaim.trim(),
          countryCode: countryCode.trim().toUpperCase() || undefined,
          evidence: [
            {
              type: 'PROVIDER_ASSERTION',
              provider: provider.trim().toUpperCase(),
              opaqueReference: opaqueReference.trim(),
              digest: digest.trim().toLowerCase()
            }
          ]
        })
      });
      setOpaqueReference('');
      setDigest('');
      await Promise.all([load(), onUpdated()]);
      Alert.alert(
        'Demande soumise',
        'KnowMe a conservé uniquement la référence opaque et l’empreinte, jamais une image de document.'
      );
    } catch (cause) {
      Alert.alert('Soumission impossible', message(cause, 'Réessaie.'));
    } finally {
      setBusy(false);
    }
  }

  function confirmWithdraw(item: VerificationRequest) {
    if (busy) return;
    Alert.prompt(
      'Retirer la demande',
      'Indique le motif du retrait.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: (value) => {
            if (value?.trim()) void withdraw(item, value.trim());
          }
        }
      ],
      'plain-text'
    );
  }

  async function withdraw(item: VerificationRequest, reason: string) {
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${item.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await Promise.all([load(), onUpdated()]);
      Alert.alert('Demande retirée');
    } catch (cause) {
      Alert.alert('Retrait impossible', message(cause, 'Réessaie.'));
    } finally {
      setBusy(false);
    }
  }

  const pending = requests.some((item) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)
  );
  const approved = requests.some(
    (item) =>
      item.status === 'APPROVED' &&
      Boolean(item.expiresAt) &&
      new Date(item.expiresAt!).getTime() > Date.now()
  );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Button title="Retour au profil" secondary onPress={onBack} />
      <Text style={styles.eyebrow}>IDENTITÉ KNOWME</Text>
      <Text style={styles.heading}>Vérification autoritaire</Text>
      <Text style={styles.description}>
        Le badge Vérifié est décidé côté serveur. Il reste indépendant de Premium et du badge
        officiel Équipe KnowMe.
      </Text>

      <View style={styles.badgeGrid}>
        <View style={styles.badgeCard}>
          <Text style={styles.badgeLabel}>IDENTITÉ</Text>
          <Text style={[styles.badgeValue, user.verification && styles.verified]}>
            {user.verification ? 'Vérifiée' : 'Non vérifiée'}
          </Text>
        </View>
        <View style={styles.badgeCard}>
          <Text style={styles.badgeLabel}>PREMIUM</Text>
          <Text style={[styles.badgeValue, user.premium && styles.premium]}>
            {user.premium ? 'Actif' : 'Inactif'}
          </Text>
        </View>
        <View style={styles.badgeCard}>
          <Text style={styles.badgeLabel}>ÉQUIPE</Text>
          <Text style={[styles.badgeValue, user.staff && styles.staff]}>
            {user.staff ? 'Officiel' : 'Utilisateur'}
          </Text>
        </View>
      </View>

      {!pending && !approved ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nouvelle demande</Text>
          <Text style={styles.description}>
            Aucun document brut n’est envoyé ici. Saisis seulement les valeurs générées par le
            futur flux de capture sécurisé ou le prestataire KYC autorisé.
          </Text>
          <TextInput
            value={displayNameClaim}
            onChangeText={setDisplayNameClaim}
            placeholder="Nom à vérifier"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <TextInput
            value={countryCode}
            onChangeText={setCountryCode}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Pays ISO, ex. BJ"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <TextInput
            value={provider}
            onChangeText={setProvider}
            autoCapitalize="characters"
            placeholder="Prestataire"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <TextInput
            value={opaqueReference}
            onChangeText={setOpaqueReference}
            autoCapitalize="none"
            placeholder="Référence opaque"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <TextInput
            value={digest}
            onChangeText={setDigest}
            autoCapitalize="none"
            maxLength={64}
            placeholder="Empreinte SHA-256"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <Button
            title={busy ? 'Soumission…' : 'Soumettre pour examen'}
            disabled={
              busy ||
              displayNameClaim.trim().length < 2 ||
              opaqueReference.trim().length < 8 ||
              digest.trim().length !== 64
            }
            onPress={() => void submit()}
          />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Historique immuable</Text>
      {requests.map((item) => (
        <View style={styles.card} key={item.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Demande #{item.submissionNumber}</Text>
            <Text style={item.status === 'APPROVED' ? styles.verified : styles.warning}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.description}>
            Soumise le {new Date(item.submittedAt).toLocaleString('fr-FR')} · {item.evidenceCount}{' '}
            référence(s)
          </Text>
          {item.expiresAt ? (
            <Text style={styles.description}>
              Échéance : {new Date(item.expiresAt).toLocaleString('fr-FR')}
            </Text>
          ) : null}
          {item.decisionReason ? (
            <Text style={styles.description}>Motif : {item.decisionReason}</Text>
          ) : null}
          {item.evidence.map((evidence) => (
            <View key={evidence.id} style={styles.evidence}>
              <Text style={styles.evidenceTitle}>
                {evidence.type} · {evidence.provider}
              </Text>
              <Text selectable style={styles.code}>{evidence.opaqueReference}</Text>
              <Text selectable style={styles.code}>{evidence.digest}</Text>
            </View>
          ))}
          {item.decisions.map((decision) => (
            <Text key={decision.id} style={styles.timeline}>
              {new Date(decision.createdAt).toLocaleString('fr-FR')} · {decision.action} ·{' '}
              {decision.reason}
            </Text>
          ))}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(item.status) ? (
            <Button
              title="Retirer la demande"
              secondary
              disabled={busy}
              onPress={() => confirmWithdraw(item)}
            />
          ) : null}
        </View>
      ))}
      {!requests.length ? (
        <View style={styles.card}>
          <Text style={styles.description}>Aucune demande enregistrée.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, gap: 14 },
  eyebrow: { color: '#65b7ff', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900' },
  sectionTitle: { color: '#f4fff9', fontSize: 22, fontWeight: '900', marginTop: 8 },
  description: { color: '#b6c8c0', fontSize: 15, lineHeight: 22 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { flexGrow: 1, minWidth: 100, backgroundColor: '#10231d', borderRadius: 18, padding: 14 },
  badgeLabel: { color: '#789187', fontSize: 11, fontWeight: '800' },
  badgeValue: { color: '#91a79e', fontSize: 17, fontWeight: '900', marginTop: 5 },
  verified: { color: '#65b7ff' },
  premium: { color: '#d8a7ff' },
  staff: { color: '#f4c95d' },
  warning: { color: '#ff9d66', fontWeight: '900' },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  cardTitle: { color: '#f4fff9', fontSize: 19, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  input: { minHeight: 52, backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', paddingHorizontal: 15, paddingVertical: 13, fontSize: 16 },
  button: { backgroundColor: '#45e6bd', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { color: '#052017', fontWeight: '900' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#65b7ff', borderWidth: 1 },
  secondaryButtonText: { color: '#65b7ff' },
  mutedButton: { opacity: 0.45 },
  evidence: { backgroundColor: '#091914', borderRadius: 14, padding: 12, gap: 6 },
  evidenceTitle: { color: '#f4fff9', fontWeight: '800' },
  code: { color: '#91a79e', fontSize: 11 },
  timeline: { color: '#91a79e', fontSize: 12, lineHeight: 18 }
});
