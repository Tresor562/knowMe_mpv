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
import { useAppearance } from './AppearanceProvider';
import { MobileUser } from './ProfileExperience';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

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

function verificationStatusLabel(value: string) {
  const labels: Record<string, string> = {
    SUBMITTED: 'Envoyée',
    UNDER_REVIEW: 'En cours',
    APPROVED: 'Vérifiée',
    REJECTED: 'Refusée',
    REVOKED: 'Révoquée',
    EXPIRED: 'Expirée',
    WITHDRAWN: 'Retirée'
  };
  return labels[value] ?? value;
}

function decisionLabel(value: string) {
  const labels: Record<string, string> = {
    SUBMIT: 'Demande envoyée',
    START_REVIEW: 'Examen commencé',
    APPROVE: 'Identité vérifiée',
    REJECT: 'Demande refusée',
    REVOKE: 'Vérification révoquée',
    WITHDRAW: 'Demande retirée',
    EXPIRE: 'Vérification expirée'
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLocaleLowerCase();
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
  const { colors, visual } = useAppearance();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: visual.controlRadius,
          backgroundColor: secondary ? 'transparent' : colors.accent,
          borderColor: secondary ? colors.accent : colors.accent
        },
        secondary && { borderWidth: 1 },
        (pressed || disabled) && styles.mutedButton
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? colors.accent : colors.accentText }]}>
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
  const { colors, visual } = useAppearance();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [displayNameClaim, setDisplayNameClaim] = useState(user.displayName);
  const [countryCode, setCountryCode] = useState('');
  const [provider, setProvider] = useState('KYC_PROVIDER');
  const [opaqueReference, setOpaqueReference] = useState('');
  const [digest, setDigest] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

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
    setWithdrawTargetId(item.id);
    setWithdrawReason('');
  }

  async function withdraw(item: VerificationRequest, reason: string) {
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${item.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await Promise.all([load(), onUpdated()]);
      setWithdrawTargetId(null);
      setWithdrawReason('');
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
          tintColor={colors.accent}
          colors={[colors.accent]}
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
      <Text style={[styles.eyebrow, { color: colors.accent }]}>IDENTITÉ KNOWME</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Vérification autoritaire</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Le badge Vérifié est décidé côté serveur. Il reste indépendant de Premium et du badge
        officiel Équipe KnowMe.
      </Text>

      <View style={styles.badgeGrid}>
        <View style={[styles.badgeCard, { backgroundColor: colors.surfaceRaised, borderRadius: visual.controlRadius }]}>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>IDENTITÉ</Text>
          <Text style={[styles.badgeValue, { color: user.verification ? '#65B7FF' : colors.muted }]}>
            {user.verification ? 'Vérifiée' : 'Non vérifiée'}
          </Text>
        </View>
        <View style={[styles.badgeCard, { backgroundColor: colors.surfaceRaised, borderRadius: visual.controlRadius }]}>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>PREMIUM</Text>
          <Text style={[styles.badgeValue, { color: user.premium ? '#D8A7FF' : colors.muted }]}>
            {user.premium ? 'Actif' : 'Inactif'}
          </Text>
        </View>
        <View style={[styles.badgeCard, { backgroundColor: colors.surfaceRaised, borderRadius: visual.controlRadius }]}>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>ÉQUIPE</Text>
          <Text style={[styles.badgeValue, { color: user.staff ? '#F4C95D' : colors.muted }]}>
            {user.staff ? 'Officiel' : 'Utilisateur'}
          </Text>
        </View>
      </View>

      {!pending && !approved ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Nouvelle demande</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Aucun document brut n’est envoyé ici. Saisis seulement les valeurs générées par le
            futur flux de capture sécurisé ou le prestataire KYC autorisé.
          </Text>
          <TextInput
            value={displayNameClaim}
            onChangeText={setDisplayNameClaim}
            placeholder="Nom à vérifier"
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
          <TextInput
            value={countryCode}
            onChangeText={setCountryCode}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Pays ISO, ex. BJ"
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
          <TextInput
            value={provider}
            onChangeText={setProvider}
            autoCapitalize="characters"
            placeholder="Prestataire"
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
          <TextInput
            value={opaqueReference}
            onChangeText={setOpaqueReference}
            autoCapitalize="none"
            placeholder="Référence opaque"
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
          <TextInput
            value={digest}
            onChangeText={setDigest}
            autoCapitalize="none"
            maxLength={64}
            placeholder="Empreinte SHA-256"
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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique immuable</Text>
      {requests.map((item) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]} key={item.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Demande #{item.submissionNumber}</Text>
            <Text style={[item.status === 'APPROVED' ? styles.verified : styles.warning, { color: item.status === 'APPROVED' ? colors.accent : colors.danger }]}>
              {item.status}
            </Text>
          </View>
          <Text style={[styles.description, { color: colors.muted }]}>
            Soumise le {new Date(item.submittedAt).toLocaleString('fr-FR')} · {item.evidenceCount}{' '}
            référence(s)
          </Text>
          {item.expiresAt ? (
            <Text style={[styles.description, { color: colors.muted }]}>
              Échéance : {new Date(item.expiresAt).toLocaleString('fr-FR')}
            </Text>
          ) : null}
          {item.decisionReason ? (
            <Text style={[styles.description, { color: colors.muted }]}>Motif : {item.decisionReason}</Text>
          ) : null}
          {item.evidence.map((evidence) => (
            <View key={evidence.id} style={[styles.evidence, { backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius }]}>
              <Text style={[styles.evidenceTitle, { color: colors.text }]}>
                {evidence.type} · {evidence.provider}
              </Text>
              <Text selectable style={[styles.code, { color: colors.muted }]}>{evidence.opaqueReference}</Text>
              <Text selectable style={[styles.code, { color: colors.muted }]}>{evidence.digest}</Text>
            </View>
          ))}
          {item.decisions.map((decision) => (
            <Text key={decision.id} style={[styles.timeline, { color: colors.muted }]}>
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.description, { color: colors.muted }]}>Aucune demande enregistrée.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, gap: 14 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heading: { fontSize: 30, fontWeight: '900' },
  sectionTitle: { fontSize: 22, fontWeight: '900', marginTop: 8 },
  description: { fontSize: 15, lineHeight: 22 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: { flexGrow: 1, minWidth: 100, padding: 14 },
  badgeLabel: { fontSize: 11, fontWeight: '800' },
  badgeValue: { fontSize: 17, fontWeight: '900', marginTop: 5 },
  verified: { color: '#65b7ff' },
  premium: { color: '#d8a7ff' },
  staff: { color: '#f4c95d' },
  warning: { color: '#FF6B73', fontWeight: '900' },
  card: { borderWidth: 1, padding: 18, gap: 12 },
  cardTitle: { fontSize: 19, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  input: { minHeight: 52, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16 },
  button: { paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontWeight: '900' },
  mutedButton: { opacity: 0.45 },
  evidence: { padding: 12, gap: 6 },
  evidenceTitle: { fontWeight: '800' },
  code: { fontSize: 11 },
  timeline: { fontSize: 12, lineHeight: 18 }
});
