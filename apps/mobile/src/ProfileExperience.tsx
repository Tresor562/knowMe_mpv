import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';

export type MobileUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  knowCoins?: number;
};

type AccountExport = {
  exportedAt: string;
  formatVersion: number;
  account: unknown;
};

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function Button({ title, onPress, disabled = false, danger = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, danger && styles.dangerButton, (pressed || disabled) && styles.buttonMuted]}
    >
      <Text style={[styles.buttonText, danger && styles.dangerText]}>{title}</Text>
    </Pressable>
  );
}

export function ProfileExperience({ user, onUpdated, onLogout, onAccountDeleted }: {
  user: MobileUser;
  onUpdated: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  async function exportAccount() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await apiFetch<AccountExport>('/account/export');
      await Share.share({
        title: `Export KnowMe ${new Date(data.exportedAt).toLocaleDateString('fr-FR')}`,
        message: JSON.stringify(data, null, 2)
      });
    } catch (cause) {
      Alert.alert('Export impossible', message(cause, 'Réessaie.'));
    } finally {
      setExporting(false);
    }
  }

  function confirmDelete() {
    if (password.length < 8 || deleting) return;
    Alert.alert(
      'Supprimer définitivement le compte ?',
      'Toutes tes données KnowMe seront supprimées. Cette action ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteAccount() }
      ]
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch('/account', {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      setPassword('');
      await onAccountDeleted();
    } catch (cause) {
      Alert.alert('Suppression impossible', message(cause, 'Vérifie ton mot de passe.'));
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
      <Text style={styles.handle}>@{user.username}</Text>
      <Text style={styles.muted}>{user.email}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{user.knowCoins ?? 0}</Text><Text style={styles.muted}>KnowCoins</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>Alpha</Text><Text style={styles.muted}>Version</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modifier mon profil</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={60} placeholder="Nom affiché" placeholderTextColor="#789187" style={styles.input} />
        <TextInput value={bio} onChangeText={setBio} maxLength={500} multiline placeholder="Biographie" placeholderTextColor="#789187" style={[styles.input, styles.multiline]} />
        <TextInput value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" keyboardType="url" placeholder="URL HTTPS de l’avatar" placeholderTextColor="#789187" style={styles.input} />
        <Text style={styles.helper}>Le nom doit contenir au moins 2 caractères. L’avatar doit utiliser une URL valide.</Text>
        <Button title={saving ? 'Enregistrement…' : 'Enregistrer'} disabled={saving || displayName.trim().length < 2} onPress={() => void save()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mes données</Text>
        <Text style={styles.description}>Génère un export JSON complet puis partage-le avec l’application de ton choix.</Text>
        <Button title={exporting ? 'Préparation…' : 'Exporter mes données'} disabled={exporting} onPress={() => void exportAccount()} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.description}>Déconnecte cet appareil sans supprimer ton compte.</Text>
        <Button title="Se déconnecter" onPress={() => void onLogout()} />
      </View>

      <View style={[styles.card, styles.dangerZone]}>
        <Text style={styles.dangerHeading}>Zone dangereuse</Text>
        <Text style={styles.description}>Saisis ton mot de passe pour confirmer la suppression définitive du compte.</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mot de passe actuel"
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
  buttonMuted: { opacity: 0.45 },
  dangerZone: { borderColor: '#784a35' },
  dangerHeading: { color: '#ff9d66', fontSize: 19, fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderColor: '#ff9d66', borderWidth: 1 },
  dangerText: { color: '#ff9d66' }
});
