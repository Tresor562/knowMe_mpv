import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { KnowMeIcon, PressScale, SoftSurface } from './ui/KnowMeUI';

type Props = {
  onBack: () => void;
};

export function AccountRecoveryExperience({ onBack }: Props) {
  const { colors, visual } = useAppearance();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    const normalized = normalizeRecoveryEmail(email);
    if (!isRecoveryEmailReady(normalized)) return;

    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch<{ accepted: true }>('/auth/password-recovery', {
        method: 'POST',
        body: JSON.stringify({ email: normalized })
      });
      setMessage(GENERIC_ACCOUNT_RECOVERY_MESSAGE);
    } catch {
      setError('La récupération de compte est temporairement indisponible. Réessaie plus tard.');
    } finally {
      setBusy(false);
    }
  }

  const ready = isRecoveryEmailReady(email);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Retour"
              disabled={busy}
              onPress={onBack}
              style={[
                styles.backButton,
                {
                  backgroundColor: colors.backgroundAccent,
                  borderColor: colors.border,
                  borderRadius: visual.controlRadius
                }
              ]}
            >
              <KnowMeIcon name="back" size={19} color={colors.text} />
            </PressScale>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Récupération</Text>
          </View>

          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>Mot de passe oublié ?</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              Entre l’adresse e-mail de ton compte KnowMe. Pour protéger ta vie privée, la réponse reste identique qu’un compte existe ou non.
            </Text>
          </View>

          <SoftSurface style={styles.form}>
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
              selectionColor={colors.accent}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundAccent,
                  borderRadius: visual.inputRadius
                }
              ]}
            />

            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Recevoir un lien de récupération"
              disabled={busy || !ready}
              onPress={() => void submit()}
              style={[
                styles.primary,
                {
                  backgroundColor: colors.accent,
                  borderRadius: visual.controlRadius
                },
                (busy || !ready) && styles.disabled
              ]}
            >
              <Text style={[styles.primaryText, { color: colors.accentText }]}>
                {busy ? 'Envoi…' : 'Recevoir le lien'}
              </Text>
            </PressScale>

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
              Une réinitialisation réussie révoque les sessions et appareils de confiance existants.
            </Text>
          </SoftSurface>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 24
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  intro: { gap: 7, paddingHorizontal: 2 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  copy: { fontSize: 14.5, lineHeight: 21 },
  form: { padding: 14, gap: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 15
  },
  primary: {
    minHeight: 50,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: { fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
  status: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 11.5, lineHeight: 17 }
});
