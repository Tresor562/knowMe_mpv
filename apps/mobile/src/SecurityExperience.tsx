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
import { GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

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
  return value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
}

function humanizeSecurityEvent(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLocaleLowerCase()
    .replace(/^./, (letter) => letter.toLocaleUpperCase());
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
        title: `Export KnowMe ${new Date(data.exportedAt).toLocaleDateString()}`,
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
    return (
      <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
        <Text style={[styles.description, { color: colors.muted }]}>Chargement de la sécurité…</Text>
      </GlassSurface>
    );
  }

  const activeTrustedDevices = status.trustedDevices.filter((item) => item.active).length;

  return (
    <GlassSurface strength="soft" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.heroRow}>
        <View style={[styles.heroIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="check" size={21} color={status.twoFactorEnabled ? colors.accent : colors.muted} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Sécurité du compte</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Protège ton accès, tes appareils et tes sessions.
          </Text>
        </View>
      </View>

      <GlassSurface strength="soft" borderRadius={20} style={styles.summaryStrip}>
        <View style={styles.summaryMetric}>
          <Text style={[styles.summaryValue, { color: status.twoFactorEnabled ? colors.accent : colors.text }]}>
            {status.twoFactorEnabled ? 'Actif' : 'Inactif'}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>2FA</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{status.sessions.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>Sessions</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{activeTrustedDevices}</Text>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>Appareils fiables</Text>
        </View>
      </GlassSurface>
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
          <Text selectable style={[styles.helper, { color: colors.muted }]}>Lien d’authentification : {setup.otpauthUri}</Text>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => void revokeSession(session.id, session.current)}
              style={[styles.removeButton, { backgroundColor: colors.backgroundAccent }]}
            >
              <Text style={[styles.remove, { color: colors.danger }]}>Révoquer</Text>
            </Pressable>
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
            {device.active ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void revokeDevice(device.id)}
                style={[styles.removeButton, { backgroundColor: colors.backgroundAccent }]}
              >
                <Text style={[styles.remove, { color: colors.danger }]}>Révoquer</Text>
              </Pressable>
            ) : null}
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
            <Text style={[styles.rowTitle, { color: colors.text }]}>{humanizeSecurityEvent(event.type)}</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              {humanizeSecurityEvent(event.severity)} · {date(event.createdAt)}
            </Text>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 14.5, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  summaryStrip: { flexDirection: 'row', padding: 5 },
  summaryMetric: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 13.5, fontWeight: '800' },
  summaryLabel: { fontSize: 9, marginTop: 1, textAlign: 'center' },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 9 },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14.5 },
  button: { minHeight: 46, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12.5, fontWeight: '800' },
  muted: { opacity: 0.45 },
  secret: { padding: 11, fontWeight: '800', letterSpacing: 0.8 },
  helper: { fontSize: 12, lineHeight: 18 },
  warning: { fontWeight: '900' },
  recoveryBox: {},
  recoveryCode: { borderRadius: 10, padding: 8, fontFamily: 'monospace' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 9 },
  rowText: { flex: 1 },
  rowTitle: { fontWeight: '800' },
  removeButton: { minHeight: 32, borderRadius: 16, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  remove: { fontSize: 11, fontWeight: '800' },
  event: { borderLeftWidth: 2, paddingLeft: 10, gap: 3 }
});
