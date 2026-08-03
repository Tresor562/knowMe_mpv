import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { AppearanceExperience } from './AppearanceExperience';
import { PaymentsExperience } from './PaymentsExperience';
import { PrivacyExperience } from './PrivacyExperience';
import { SecurityExperience } from './SecurityExperience';
import { SocialGiftsExperience } from './SocialGiftsExperience';

export type MobileUser = {
  id: string;
  accountId?: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  knowCoins?: number;
  role?: string;
  staff?: {
    isTeamMember: true;
    label: string;
    shield: string;
    role: string;
  } | null;
  verification?: {
    isVerified: true;
    label: string;
    level: string;
    verifiedAt: string;
    expiresAt: string;
    verificationId: string;
  } | null;
  premium?: {
    isPremium: true;
    label: string;
    expiresAt?: string | null;
  } | null;
};

type ReauthResult = {
  proofToken: string;
  assurance: string;
  expiresAt: string;
};

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function Button({ title, onPress, disabled = false, danger = false, secondary = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger && styles.dangerButton,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text style={[
        styles.buttonText,
        danger && styles.dangerText,
        secondary && styles.secondaryButtonText
      ]}>{title}</Text>
    </Pressable>
  );
}

export function ProfileExperience({ user, onUpdated, onLogout, onAccountDeleted, onOpenVerification }: {
  user: MobileUser;
  onUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onOpenVerification: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [password, setPassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user]);

  async function save() {
    if (saving || displayName.trim().length < 2) return;
    setSaving(true);
    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {})
        })
      });
      await onUpdated();
      Alert.alert('Profil enregistré', 'Tes informations ont été mises à jour.');
    } catch (cause) {
      Alert.alert('Modification impossible', message(cause, 'Réessaie.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (password.length < 8 || deleting) return;
    Alert.alert(
      'Supprimer définitivement le compte ?',
      'KnowMe exigera une réauthentification serveur, puis supprimera toutes les données, décisions de confidentialité et appareils. Cette action ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteAccount() }
      ]
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const proof = await apiFetch<ReauthResult>('/security/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({
          password,
          code: deleteCode.trim() || undefined
        })
      });
      await apiFetch('/account', {
        method: 'DELETE',
        headers: { 'x-reauth-token': proof.proofToken },
        body: JSON.stringify({ password })
      });
      setPassword('');
      setDeleteCode('');
      await onAccountDeleted();
    } catch (cause) {
      Alert.alert('Suppression impossible', message(cause, 'Vérifie le mot de passe et le code 2FA.'));
    } finally {
      setDeleting(false);
    }
  }

  const avatarInitial = user.displayName.charAt(0).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}><Text style={styles.avatarText}>{avatarInitial}</Text></View>
      )}
      <Text style={styles.heading}>{user.displayName}</Text>
      <View style={styles.badges}>
        {user.verification ? (
          <View style={styles.verificationBadge} accessibilityLabel={user.verification.label}>
            <Text style={styles.verificationBadgeText}>✓ {user.verification.label}</Text>
          </View>
        ) : null}
        {user.premium ? (
          <View style={styles.premiumBadge} accessibilityLabel={user.premium.label}>
            <Text style={styles.premiumBadgeText}>◆ {user.premium.label}</Text>
          </View>
        ) : null}
        {user.staff ? (
          <View style={styles.staffBadge} accessibilityLabel={`${user.staff.label}, ${user.staff.role}`}>
            <Text style={styles.staffBadgeText}>🛡️ {user.staff.label} · {user.staff.role}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.handle}>@{user.username}</Text>
      <Text style={styles.muted}>{user.email}</Text>
      <Text style={styles.accountId}>ID compte : {user.accountId ?? user.id}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{user.knowCoins ?? 0}</Text><Text style={styles.muted}>KnowCoins</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{user.verification ? 'Vérifié' : 'Actif'}</Text><Text style={styles.muted}>Identité</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Identité et confiance</Text>
        <Text style={styles.description}>
          Consulte ton historique, soumets une référence de preuve ou retire une demande encore ouverte.
        </Text>
        <Button title="Gérer ma vérification" secondary onPress={onOpenVerification} />
      </View>

      <AppearanceExperience />
      <PaymentsExperience />
      <SocialGiftsExperience />
      <SecurityExperience onSessionClosed={onAccountDeleted} />
      <PrivacyExperience />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modifier mon profil</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={60} placeholder="Nom affiché" placeholderTextColor="#789187" style={styles.input} />
        <TextInput value={bio} onChangeText={setBio} maxLength={500} multiline placeholder="Biographie" placeholderTextColor="#789187" style={[styles.input, styles.multiline]} />
        <TextInput value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" keyboardType="url" placeholder="URL HTTPS de l’avatar" placeholderTextColor="#789187" style={styles.input} />
        <Text style={styles.helper}>Le nom doit contenir au moins 2 caractères. L’avatar doit utiliser une URL valide.</Text>
        <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} disabled={saving || displayName.trim().length < 2} onPress={() => void save()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.description}>Déconnecte cet appareil sans supprimer ton compte. L’autorisation d’appareil de confiance reste révocable séparément.</Text>
        <Button title="Se déconnecter" onPress={() => void onLogout()} />
      </View>

      <View style={[styles.card, styles.dangerZone]}>
        <Text style={styles.dangerHeading}>Zone dangereuse</Text>
        <Text style={styles.description}>La suppression exige toujours le mot de passe, une preuve serveur récente et le second facteur lorsqu’il est actif.</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mot de passe actuel"
          placeholderTextColor="#789187"
          style={styles.input}
        />
        <TextInput
          value={deleteCode}
          onChangeText={setDeleteCode}
          autoCapitalize="characters"
          placeholder="Code 2FA ou récupération, si activé"
          placeholderTextColor="#789187"
          style={styles.input}
        />
        <Button title={deleting ? 'Suppression…' : 'Supprimer mon compte'} disabled={deleting || password.length < 8} danger onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, gap: 14 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#45e6bd', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#1b3b31' },
  avatarText: { color: '#052017', fontSize: 38, fontWeight: '900' },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900' },
  handle: { color: '#45e6bd', fontWeight: '800' },
  muted: { color: '#91a79e' },
  accountId: { color: '#789187', fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  verificationBadge: { borderColor: '#65b7ff', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(101,183,255,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  verificationBadgeText: { color: '#65b7ff', fontWeight: '900', fontSize: 13 },
  premiumBadge: { borderColor: '#d8a7ff', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(216,167,255,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  premiumBadgeText: { color: '#d8a7ff', fontWeight: '900', fontSize: 13 },
  staffBadge: { borderColor: '#f4c95d', borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(244,201,93,0.08)', paddingHorizontal: 12, paddingVertical: 8 },
  staffBadgeText: { color: '#f4c95d', fontWeight: '900', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: '#10231d', borderRadius: 18, padding: 14 },
  statValue: { color: '#f4fff9', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  cardTitle: { color: '#f4fff9', fontSize: 19, fontWeight: '900' },
  description: { color: '#b6c8c0', fontSize: 15, lineHeight: 22 },
  helper: { color: '#789187', fontSize: 12, lineHeight: 18 },
  input: { minHeight: 52, backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  multiline: { minHeight: 100 },
  button: { backgroundColor: '#45e6bd', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { color: '#052017', fontWeight: '900' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#65b7ff', borderWidth: 1 },
  secondaryButtonText: { color: '#65b7ff' },
  buttonMuted: { opacity: 0.45 },
  dangerZone: { borderColor: '#784a35' },
  dangerHeading: { color: '#ff9d66', fontSize: 19, fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderColor: '#ff9d66', borderWidth: 1 },
  dangerText: { color: '#ff9d66' }
});
