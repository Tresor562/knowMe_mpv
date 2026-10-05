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
      <View style={styles.topRow}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Retour au profil"
          onPress={onBack}
          style={[
            styles.backButton,
            { backgroundColor: colors.backgroundAccent, borderColor: colors.border }
          ]}
        >
          <KnowMeIcon name="back" size={18} color={colors.text} />
        </PressScale>
        <View style={styles.topCopy}>
          <Text style={[styles.heading, { color: colors.text }]}>Identité</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Vérification du titulaire du compte
          </Text>
        </View>
      </View>

      <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.identityHero}>
        <View style={[styles.identityHeroIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon
            name="check"
            size={24}
            color={user.verification ? colors.accent : colors.muted}
          />
        </View>
        <View style={styles.identityHeroCopy}>
          <Text style={[styles.identityState, { color: colors.text }]}>
            {user.verification ? 'Identité vérifiée' : pending ? 'Vérification en cours' : 'Identité non vérifiée'}
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            {user.verification
              ? 'Ton badge Vérifié est actif sur KnowMe.'
              : pending
                ? 'Ta demande est en cours de traitement.'
                : 'La vérification reste distincte de Premium et des rôles Équipe.'}
          </Text>
        </View>
      </GlassSurface>

      <GlassSurface strength="soft" borderRadius={20} style={styles.badgeGrid}>
        <View style={styles.badgeCard}>
          <Text style={[styles.badgeValue, { color: user.verification ? colors.accent : colors.text }]}>
            {user.verification ? 'Vérifiée' : 'Non'}
          </Text>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>Identité</Text>
        </View>
        <View style={styles.badgeCard}>
          <Text style={[styles.badgeValue, { color: user.premium ? colors.secondary : colors.text }]}>
            {user.premium ? 'Actif' : 'Non'}
          </Text>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>Premium</Text>
        </View>
        <View style={styles.badgeCard}>
          <Text style={[styles.badgeValue, { color: user.staff ? '#F4C95D' : colors.text }]}>
            {user.staff ? 'Équipe' : 'Membre'}
          </Text>
          <Text style={[styles.badgeLabel, { color: colors.muted }]}>Compte</Text>
        </View>
      </GlassSurface>

      {!pending && !approved ? (
        <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
          <View style={styles.secureNoticeRow}>
            <View style={[styles.secureNoticeIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="settings" size={20} color={colors.accent} />
            </View>
            <View style={styles.secureNoticeCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Vérification sécurisée</Text>
              <Text style={[styles.description, { color: colors.muted }]}>
                Aucun prestataire de vérification mobile n’est encore connecté à ce build. KnowMe ne te demandera pas de saisir ou d’envoyer une photo de document ici.
              </Text>
            </View>
          </View>

          <Button
            title={advancedOpen ? 'Masquer l’import avancé' : 'Importer une preuve déjà générée'}
            secondary
            onPress={() => setAdvancedOpen((current) => !current)}
          />

          {advancedOpen ? (
            <View style={styles.advancedBox}>
              <Text style={[styles.advancedTitle, { color: colors.text }]}>Import avancé</Text>
              <Text style={[styles.helper, { color: colors.muted }]}>
                Réservé à une preuve produite par un prestataire autorisé. Ne saisis jamais de numéro de document ni de donnée biométrique brute.
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
                placeholder="Pays, ex. BJ"
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
                placeholder="Identifiant du prestataire autorisé"
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
                placeholder="Référence sécurisée"
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
                placeholder="Empreinte de preuve"
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
                title={busy ? 'Soumission…' : 'Importer la preuve'}
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
        </GlassSurface>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique</Text>
      {requests.map((item) => (
        <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card} key={item.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Demande #{item.submissionNumber}</Text>
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.status === 'APPROVED'
                      ? colors.accent
                      : ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)
                        ? colors.secondary
                        : colors.muted
                }
              ]}
            >
              {verificationStatusLabel(item.status)}
            </Text>
          </View>
          <Text style={[styles.description, { color: colors.muted }]}>
            {new Date(item.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {item.evidenceCount} preuve(s)
          </Text>
          {item.expiresAt ? (
            <Text style={[styles.description, { color: colors.muted }]}>
              Valide jusqu’au {new Date(item.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          ) : null}
          {item.decisionReason ? (
            <Text style={[styles.description, { color: colors.muted }]}>Motif : {item.decisionReason}</Text>
          ) : null}
          {item.evidence.map((evidence) => (
            <View key={evidence.id} style={[styles.evidence, { backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius }]}>
              <KnowMeIcon name="check" size={16} color={colors.accent} />
              <View style={styles.evidenceCopy}>
                <Text style={[styles.evidenceTitle, { color: colors.text }]}>Preuve sécurisée enregistrée</Text>
                <Text style={[styles.helper, { color: colors.muted }]}>{evidence.provider}</Text>
              </View>
            </View>
          ))}
          {item.decisions.map((decision) => (
            <Text key={decision.id} style={[styles.timeline, { color: colors.muted }]}>
              {new Date(decision.createdAt).toLocaleDateString()} · {decisionLabel(decision.action)} · {decision.reason}
            </Text>
          ))}
          {['SUBMITTED', 'UNDER_REVIEW'].includes(item.status) ? (
            withdrawTargetId === item.id ? (
              <View style={styles.withdrawBox}>
                <TextInput
                  value={withdrawReason}
                  onChangeText={setWithdrawReason}
                  maxLength={500}
                  placeholder="Pourquoi veux-tu retirer cette demande ?"
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
                <View style={styles.withdrawActions}>
                  <Button
                    title="Annuler"
                    secondary
                    disabled={busy}
                    onPress={() => {
                      setWithdrawTargetId(null);
                      setWithdrawReason('');
                    }}
                  />
                  <Button
                    title={busy ? 'Retrait…' : 'Confirmer le retrait'}
                    disabled={busy || withdrawReason.trim().length < 3}
                    onPress={() => void withdraw(item, withdrawReason.trim())}
                  />
                </View>
              </View>
            ) : (
              <Button
                title="Retirer la demande"
                secondary
                disabled={busy}
                onPress={() => confirmWithdraw(item)}
              />
            )
          ) : null}
        </GlassSurface>
      ))}
      {!requests.length ? (
        <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
          <Text style={[styles.description, { color: colors.muted }]}>Aucune demande enregistrée.</Text>
        </GlassSurface>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 30, gap: 11 },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topCopy: { flex: 1 },
  heading: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  description: { fontSize: 12.5, lineHeight: 18 },
  identityHero: { minHeight: 82, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  identityHeroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  identityHeroCopy: { flex: 1 },
  identityState: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  badgeGrid: { flexDirection: 'row', padding: 5 },
  badgeCard: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  badgeValue: { fontSize: 13, fontWeight: '800' },
  card: { padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  statusText: { fontSize: 11, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  secureNoticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  secureNoticeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  secureNoticeCopy: { flex: 1 },
  advancedBox: { gap: 9, paddingTop: 4 },
  advancedTitle: { fontSize: 13, fontWeight: '800' },
  helper: { fontSize: 11, lineHeight: 16 },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14
  },
  button: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '800' },
  mutedButton: { opacity: 0.45 },
  evidence: { minHeight: 48, padding: 9, gap: 8, flexDirection: 'row', alignItems: 'center' },
  evidenceCopy: { flex: 1 },
  evidenceTitle: { fontSize: 12, fontWeight: '800' },
  timeline: { fontSize: 10.5, lineHeight: 15 },
  withdrawBox: { gap: 8, paddingTop: 2 },
  withdrawActions: { flexDirection: 'row', gap: 8 }
});
