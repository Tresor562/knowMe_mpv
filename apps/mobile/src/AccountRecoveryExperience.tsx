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
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

const GENERIC_RECOVERY_MESSAGE =
  'Si un compte correspond à cette adresse, un lien de récupération sera envoyé. Vérifie aussi les courriers indésirables.';

type Props = {
  onBack: () => void;
};

export function AccountRecoveryExperience({ onBack }: Props) {
  const { colors } = useAppearance();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    const normalized = email.trim();
    if (!normalized.includes('@')) return;

    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch<{ accepted: true }>('/auth/password-recovery', {
        method: 'POST',
        body: JSON.stringify({ email: normalized })
      });
      setMessage(GENERIC_RECOVERY_MESSAGE);
    } catch {
      setError('La récupération de compte est temporairement indisponible. Réessaie plus tard.');
    } finally {
      setBusy(false);
    }
  }

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
            Entre l’adresse e-mail de ton compte KnowMe. Pour protéger ta vie privée, la réponse reste identique qu’un compte existe ou non.
          </Text>

          <TextInput
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
          />

          <Pressable
            accessibilityRole="button"
            disabled={busy || !email.trim().includes('@')}
            onPress={() => void submit()}
            style={[
              styles.primary,
              { backgroundColor: colors.accent },
              (busy || !email.trim().includes('@')) && styles.disabled
            ]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              {busy ? 'Envoi…' : 'Recevoir un lien de récupération'}
            </Text>
          </Pressable>

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
            Le lien reçu ouvre le parcours sécurisé de réinitialisation KnowMe. Il expire selon la politique serveur et une réinitialisation réussie révoque les sessions et appareils de confiance existants.
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
