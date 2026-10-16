import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  GENERIC_ACCOUNT_RECOVERY_MESSAGE,
  isRecoveryEmailReady,
  normalizeRecoveryEmail
} from './account-recovery-model';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Props = {
  onBack: () => void;
};

export function AccountRecoveryExperience({ onBack }: Props) {
  const { colors, visual } = useAppearance();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function submit() {
    const normalized = normalizeRecoveryEmail(email);
    if (!isRecoveryEmailReady(normalized)) return;

    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch<{ accepted: true }>('/auth/password-recovery/code', {
        method: 'POST',
        body: JSON.stringify({ email: normalized })
      });
      setSent(true);
      setMessage(GENERIC_ACCOUNT_RECOVERY_MESSAGE);
    } catch {
      setError('La récupération de compte est temporairement indisponible. Réessaie plus tard.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (code.length !== 6 || password.length < 12) return;
    if (password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await apiFetch('/auth/password-reset/code', {
        method: 'POST',
        body: JSON.stringify({ email: normalizeRecoveryEmail(email), code, password })
      });
      setDone(true);
      setMessage('Mot de passe modifié. Tes anciennes sessions ont été fermées.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Code invalide ou expiré.');
    } finally { setBusy(false); }
  }

  const ready = isRecoveryEmailReady(email);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onBack}>
            <Text style={[styles.back, { color: colors.accent }]}>← Retour</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>RÉCUPÉRATION DE COMPTE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Mot de passe oublié</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            Saisis ton adresse email pour recevoir un code temporaire et récupérer ton compte.
          </Text>

          {!sent && !done ? <TextInput
            accessibilityLabel="Adresse e-mail de récupération"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="Adresse e-mail"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface
              }
            ]}
          /> : null}

          {sent && !done ? <>
            <Text style={[styles.copy, { color: colors.muted }]}>{email}</Text>
            <TextInput value={code} onChangeText={v=>setCode(v.replace(/[^0-9]/g,''))} maxLength={6}
              keyboardType="number-pad" placeholder="Code à 6 chiffres" placeholderTextColor={colors.muted}
              style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.surface}]} />
            <TextInput value={password} onChangeText={setPassword} secureTextEntry
              placeholder="Nouveau mot de passe (12 caractères minimum)" placeholderTextColor={colors.muted}
              style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.surface}]} />
            <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry
              placeholder="Confirmer le mot de passe" placeholderTextColor={colors.muted}
              style={[styles.input,{color:colors.text,borderColor:colors.border,backgroundColor:colors.surface}]} />
          </> : null}

          {!done ? <Pressable
            accessibilityRole="button"
            disabled={busy || (sent ? code.length !== 6 || password.length < 12 : !ready)}
            onPress={() => void (sent ? reset() : submit())}
            style={[
              styles.primary,
              { backgroundColor: colors.accent },
              (busy || (sent ? code.length !== 6 || password.length < 12 : !ready)) && styles.disabled
            ]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              {busy ? 'Traitement…' : sent ? 'Réinitialiser mon mot de passe' : 'Recevoir un code'}
            </Text>
          </Pressable> : null}

          {sent && !done ? <Pressable onPress={() => { setSent(false);setCode('');setError('');setMessage(''); }} disabled={busy} accessibilityRole="button">
            <Text style={[styles.back,{color:colors.accent}]}>Demander un nouveau code</Text>
          </Pressable> : null}

          {message ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.muted }]}>
              {message}
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.danger }]}>
              {error}
            </Text>
          ) : null}

          <Text style={[styles.note, { color: colors.muted }]}>
            Ce code expire dans 10 minutes et ne peut être utilisé qu’une fois. La récupération révoque les sessions précédentes.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 15 },
  back: { fontWeight: '800', marginBottom: 8 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 16, minHeight: 52, paddingHorizontal: 15, fontSize: 16 },
  primary: { borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center' },
  primaryText: { fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.45 },
  status: { fontSize: 14, lineHeight: 21 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 4 }
});
