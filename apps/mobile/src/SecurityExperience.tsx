import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  apiFetch,
  clearTrustedDeviceToken
} from './api';
import { useAppearance } from './AppearanceProvider';

type SecurityStatus = {
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
  lockedUntil?: string | null;
  sessions: Array<{
    id: string;
    userAgent?: string | null;
    createdAt: string;
    expiresAt: string;
    current: boolean;
  }>;
  trustedDevices: Array<{
    id: string;
    label: string;
    platform?: string | null;
    lastSeenAt: string;
    trustedUntil: string;
    active: boolean;
  }>;
  events: Array<{
    id: string;
    type: string;
    severity: string;
    createdAt: string;
  }>;
};

type SetupResult = { secret: string; otpauthUri: string };
type RecoveryResult = { recoveryCodes: string[] };
type ReauthResult = { proofToken: string; expiresAt: string };
type AccountExport = { exportedAt: string; formatVersion: number; account: unknown };

function Button({ title, onPress, disabled = false, secondary = false, danger = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
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
          backgroundColor: secondary || danger ? 'transparent' : colors.accent,
          borderColor: danger ? colors.danger : colors.accent
        },
        (secondary || danger) && { borderWidth: 1 },
        (pressed || disabled) && styles.muted
      ]}
    >
      <Text style={[
        styles.buttonText,
        { color: danger ? colors.danger : secondary ? colors.accent : colors.accentText }
      ]}>{title}</Text>
    </Pressable>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { colors, visual } = useAppearance();
  return (
    <TextInput
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
      {...props}
    />
  );
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}

export function SecurityExperience({ onSessionClosed }: {
  onSessionClosed: () => Promise<void>;
}) {
  const { colors, visual } = useAppearance();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [proofPassword, setProofPassword] = useState('');
  const [proofCode, setProofCode] = useState('');
  const [reauthToken, setReauthToken] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch<SecurityStatus>('/security'));
    } catch (cause) {
      Alert.alert('Sécurité indisponible', cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function beginSetup() {
    if (busy || setupPassword.length < 8) return;
    setBusy(true);
    try {
      setSetup(await apiFetch<SetupResult>('/security/2fa/setup', {
        method: 'POST',
        body: JSON.stringify({ password: setupPassword })
      }));
      setSetupPassword('');
      Alert.alert('Secret généré', 'Ajoute le secret dans ton application d’authentification, puis confirme un code.');
    } catch (cause) {
      Alert.alert('Configuration impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (busy || setupCode.trim().length !== 6) return;
    setBusy(true);
    try {
      const result = await apiFetch<RecoveryResult>('/security/2fa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: setupCode.trim() })
      });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setSetupCode('');
      await load();
      Alert.alert('2FA activé', 'Sauvegarde maintenant les codes de récupération.');
    } catch (cause) {
      Alert.alert('Code invalide', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function shareRecoveryCodes() {
    if (!recoveryCodes.length) return;
    await Share.share({
      title: 'Codes de récupération KnowMe',
      message: `Codes KnowMe — chaque code fonctionne une seule fois\n\n${recoveryCodes.join('\n')}`
    });
  }

  async function reauthenticate() {
    if (busy || proofPassword.length < 8) return;
    setBusy(true);
    try {
      const proof = await apiFetch<ReauthResult>('/security/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({
          password: proofPassword,
          code: proofCode.trim() || undefined
        })
      });
      setReauthToken(proof.proofToken);
      setProofPassword('');
      setProofCode('');
      Alert.alert('Preuve créée', `Valide une seule fois jusqu’au ${date(proof.expiresAt)}.`);
    } catch (cause) {
      Alert.alert('Réauthentification impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function exportAccount() {
    setBusy(true);
    try {
      const data = await apiFetch<AccountExport>('/account/export', {
        headers: reauthToken ? { 'x-reauth-token': reauthToken } : undefined
      });
      setReauthToken('');
      await Share.share({
        title: `Export KnowMe ${new Date(data.exportedAt).toLocaleDateString('fr-FR')}`,
        message: JSON.stringify(data, null, 2)
      });
    } catch (cause) {
      Alert.alert('Export impossible', cause instanceof Error ? cause.message : 'Crée d’abord une preuve de réauthentification.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (busy || currentPassword.length < 8 || newPassword.length < 10) return;
    setBusy(true);
    try {
      await apiFetch('/security/password', {
        method: 'PATCH',
        body: JSON.stringify({
          password: currentPassword,
          newPassword,
          code: passwordCode.trim() || undefined
        })
      });
      await clearTrustedDeviceToken();
      setCurrentPassword('');
      setNewPassword('');
      setPasswordCode('');
      await load();
      Alert.alert('Mot de passe modifié', 'Les autres sessions et appareils de confiance ont été révoqués.');
    } catch (cause) {
      Alert.alert('Modification impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: string, current: boolean) {
    setBusy(true);
    try {
      await apiFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
      if (current) {
        await onSessionClosed();
        return;
      }
      await load();
    } catch (cause) {
      Alert.alert('Révocation impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/security/devices/${id}`, { method: 'DELETE' });
      await clearTrustedDeviceToken();
      await load();
    } catch (cause) {
      Alert.alert('Révocation impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}><Text style={[styles.description, { color: colors.muted }]}>Chargement de la sécurité…</Text></View>;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
      <Text style={[styles.title, { color: colors.text }]}>Sécurité du compte</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        2FA : {status.twoFactorEnabled ? 'activé' : 'non activé'} · {status.sessions.length} session(s) · {status.trustedDevices.filter((item) => item.active).length} appareil(s) fiable(s)
      </Text>
      {status.lockedUntil ? <Text style={[styles.warning, { color: colors.danger }]}>Second facteur verrouillé jusqu’au {date(status.lockedUntil)}</Text> : null}

      {!status.twoFactorEnabled && !setup ? (
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Activer le 2FA</Text>
          <Input value={setupPassword} onChangeText={setSetupPassword} secureTextEntry placeholder="Mot de passe actuel" />
          <Button title="Commencer la configuration" disabled={busy || setupPassword.length < 8} onPress={() => void beginSetup()} />
        </View>
      ) : null}

      {setup ? (
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Secret à ajouter dans l’application d’authentification</Text>
          <Text selectable style={[styles.secret, { backgroundColor: colors.backgroundAccent, color: colors.accent, borderRadius: visual.controlRadius }]}>{setup.secret}</Text>
          <Text style={[styles.helper, { color: colors.muted }]}>URI avancée : {setup.otpauthUri}</Text>
          <Input value={setupCode} onChangeText={setSetupCode} keyboardType="number-pad" placeholder="Code à 6 chiffres" maxLength={6} />
          <Button title="Confirmer et activer" disabled={busy || setupCode.trim().length !== 6} onPress={() => void confirmSetup()} />
        </View>
      ) : null}

      {recoveryCodes.length ? (
        <View style={[styles.section, styles.recoveryBox, { borderColor: colors.danger }]}>
          <Text style={[styles.warning, { color: colors.danger }]}>Sauvegarde ces codes maintenant</Text>
          {recoveryCodes.map((code) => <Text selectable key={code} style={[styles.recoveryCode, { color: colors.text, backgroundColor: colors.backgroundAccent }]}>{code}</Text>)}
          <Button title="Partager vers un emplacement sûr" onPress={() => void shareRecoveryCodes()} />
          <Button title="J’ai sauvegardé les codes" secondary onPress={() => setRecoveryCodes([])} />
        </View>
      ) : null}

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>Changer le mot de passe</Text>
        <Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Mot de passe actuel" />
        <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Nouveau mot de passe fort" />
        {status.twoFactorEnabled ? <Input value={passwordCode} onChangeText={setPasswordCode} autoCapitalize="characters" placeholder="Code 2FA ou récupération" /> : null}
        <Button title="Modifier et fermer les autres sessions" disabled={busy || currentPassword.length < 8 || newPassword.length < 10} onPress={() => void changePassword()} />
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>Sessions actives</Text>
        {status.sessions.map((session) => (
          <View key={session.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{session.current ? 'Session actuelle' : 'Autre session'}</Text>
              <Text style={[styles.helper, { color: colors.muted }]}>{session.userAgent || 'Appareil inconnu'}</Text>
              <Text style={[styles.helper, { color: colors.muted }]}>Expire : {date(session.expiresAt)}</Text>
            </View>
            <Pressable onPress={() => void revokeSession(session.id, session.current)}><Text style={[styles.remove, { color: colors.danger }]}>Révoquer</Text></Pressable>
          </View>
        ))}
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>Appareils de confiance</Text>
        {status.trustedDevices.map((device) => (
          <View key={device.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{device.label}</Text>
              <Text style={[styles.helper, { color: colors.muted }]}>{device.platform || 'UNKNOWN'} · {device.active ? 'actif' : 'révoqué/expiré'}</Text>
              <Text style={[styles.helper, { color: colors.muted }]}>Jusqu’au {date(device.trustedUntil)}</Text>
            </View>
            {device.active ? <Pressable onPress={() => void revokeDevice(device.id)}><Text style={[styles.remove, { color: colors.danger }]}>Révoquer</Text></Pressable> : null}
          </View>
        ))}
        {!status.trustedDevices.length ? <Text style={[styles.helper, { color: colors.muted }]}>Aucun appareil de confiance.</Text> : null}
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>Action sensible</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>La preuve est liée à cette session, expire après 10 minutes et fonctionne une seule fois.</Text>
        <Input value={proofPassword} onChangeText={setProofPassword} secureTextEntry placeholder="Mot de passe actuel" />
        {status.twoFactorEnabled ? <Input value={proofCode} onChangeText={setProofCode} autoCapitalize="characters" placeholder="Code 2FA ou récupération" /> : null}
        <Button title="Créer une preuve temporaire" disabled={busy || proofPassword.length < 8} onPress={() => void reauthenticate()} />
        <Button title={reauthToken ? 'Exporter avec la preuve' : 'Exporter mes données'} secondary disabled={busy} onPress={() => void exportAccount()} />
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.subtitle, { color: colors.text }]}>Journal récent</Text>
        {status.events.slice(0, 12).map((event) => (
          <View key={event.id} style={[styles.event, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{event.type}</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>{event.severity} · {date(event.createdAt)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 18, gap: 16 },
  title: { fontSize: 19, fontWeight: '900' },
  subtitle: { fontSize: 16, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  section: { borderTopWidth: 1, paddingTop: 14, gap: 10 },
  input: { minHeight: 50, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15 },
  button: { paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontWeight: '900' },
  muted: { opacity: 0.45 },
  secret: { padding: 12, fontWeight: '900', letterSpacing: 1 },
  helper: { fontSize: 12, lineHeight: 18 },
  warning: { fontWeight: '900' },
  recoveryBox: {},
  recoveryCode: { borderRadius: 10, padding: 8, fontFamily: 'monospace' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: 10 },
  rowText: { flex: 1 },
  rowTitle: { fontWeight: '800' },
  remove: { fontWeight: '900' },
  event: { borderLeftWidth: 2, paddingLeft: 10, gap: 3 }
});
