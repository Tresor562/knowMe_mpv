import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useAppearance } from './AppearanceProvider';
import {
  clearGuestSession,
  clearQuickMathSessionId,
  createGuestIdentity,
  createQuickMathSession,
  getGuestToken,
  getSavedQuickMathSessionId,
  GuestAgeGateState,
  GuestIdentity,
  GuestQuickMathSession,
  resumeGuestIdentity,
  resumeQuickMathSession,
  revokeGuestSession,
  submitQuickMathAction
} from './guest-play';

type Props = {
  onBack: () => void;
};

export function GuestQuickMathExperience({ onBack }: Props) {
  const { colors } = useAppearance();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [session, setSession] = useState<GuestQuickMathSession | null>(null);
  const [alias, setAlias] = useState('');
  const [ageGateState, setAgeGateState] = useState<GuestAgeGateState | null>(null);
  const [temporaryConfirmed, setTemporaryConfirmed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const restore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!(await getGuestToken())) return;
      const restoredGuest = await resumeGuestIdentity();
      setGuest(restoredGuest);
      const savedSessionId = await getSavedQuickMathSessionId();
      if (savedSessionId) {
        try {
          setSession(await resumeQuickMathSession(savedSessionId));
        } catch {
          await clearQuickMathSessionId();
        }
      }
    } catch {
      await clearGuestSession();
      setGuest(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  async function startGuest() {
    if (!ageGateState || !temporaryConfirmed) return;
    setBusy(true);
    setError('');
    try {
      setGuest(await createGuestIdentity({ publicAlias: alias, ageGateState }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de créer la session invitée.');
    } finally {
      setBusy(false);
    }
  }

  async function newGame() {
    setBusy(true);
    setError('');
    try {
      setSession(await createQuickMathSession());
      setAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de démarrer Quick Math.');
    } finally {
      setBusy(false);
    }
  }

  async function applyAction(actionType: 'START' | 'ANSWER') {
    if (!session) return;
    const numericAnswer = Number.parseInt(answer.trim(), 10);
    if (actionType === 'ANSWER' && !Number.isInteger(numericAnswer)) {
      setError('Entre une réponse entière valide.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await submitQuickMathAction(
        session,
        actionType,
        actionType === 'ANSWER' ? { answer: numericAnswer } : {}
      );
      setSession(updated);
      setAnswer('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function resetGuest() {
    setBusy(true);
    setError('');
    try {
      await revokeGuestSession();
      setGuest(null);
      setSession(null);
      setAlias('');
      setAgeGateState(null);
      setTemporaryConfirmed(false);
      setAnswer('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de terminer la session invitée. Réessaie lorsque le réseau est disponible.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.accent }]}>← Retour</Text>
        </Pressable>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>PLAY · INVITÉ</Text>
        <Text style={[styles.title, { color: colors.text }]}>Quick Math</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>Joue avant de créer un compte. Le score et le résultat restent calculés par le serveur.</Text>

        {!guest ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Session temporaire</Text>
            <TextInput
              value={alias}
              onChangeText={setAlias}
              placeholder="Pseudo temporaire (facultatif)"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <Text style={[styles.label, { color: colors.muted }]}>Choisis la situation adaptée :</Text>
            {([
              ['ADULT', 'Je suis adulte'],
              ['MINOR_ALLOWED', 'Je suis mineur et autorisé à utiliser ce parcours']
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: ageGateState === value }}
                onPress={() => setAgeGateState(value)}
                style={[styles.option, { borderColor: ageGateState === value ? colors.accent : colors.border }]}
              >
                <Text style={{ color: colors.text }}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: temporaryConfirmed }}
              onPress={() => setTemporaryConfirmed((current) => !current)}
              style={styles.confirmRow}
            >
              <View style={[styles.checkbox, { borderColor: colors.accent, backgroundColor: temporaryConfirmed ? colors.accent : 'transparent' }]} />
              <Text style={[styles.confirmText, { color: colors.muted }]}>Je comprends qu’il s’agit d’une identité temporaire et que certaines données peuvent expirer si je ne crée pas de compte.</Text>
            </Pressable>
            <Pressable
              disabled={busy || !ageGateState || !temporaryConfirmed}
              onPress={() => void startGuest()}
              style={[styles.primary, { backgroundColor: colors.accent }, (busy || !ageGateState || !temporaryConfirmed) && styles.disabled]}
            >
              <Text style={[styles.primaryText, { color: colors.accentText }]}>{busy ? 'Création…' : 'Continuer en invité'}</Text>
            </Pressable>
          </View>
        ) : !session ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Prêt à jouer{guest.publicAlias ? `, ${guest.publicAlias}` : ''} ?</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>5 manches. Addition ou soustraction. Aucun compte requis.</Text>
            <Pressable disabled={busy} onPress={() => void newGame()} style={[styles.primary, { backgroundColor: colors.accent }, busy && styles.disabled]}>
              <Text style={[styles.primaryText, { color: colors.accentText }]}>{busy ? 'Démarrage…' : 'Lancer Quick Math'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: colors.text }]}>{session.state.score} pts</Text>
              <Text style={[styles.round, { color: colors.muted }]}>{session.state.round}/{session.state.maxRounds}</Text>
            </View>
            {session.state.phase === 'READY' ? (
              <Pressable disabled={busy} onPress={() => void applyAction('START')} style={[styles.primary, { backgroundColor: colors.accent }, busy && styles.disabled]}>
                <Text style={[styles.primaryText, { color: colors.accentText }]}>Commencer</Text>
              </Pressable>
            ) : session.state.phase === 'ACTIVE' && session.state.question ? (
              <>
                <Text style={[styles.question, { color: colors.text }]}>{session.state.question.left} {session.state.question.operator} {session.state.question.right} = ?</Text>
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  keyboardType="number-pad"
                  placeholder="Ta réponse"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                {session.state.lastOutcome ? (
                  <Text style={[styles.copy, { color: session.state.lastOutcome.correct ? colors.accent : colors.danger }]}>
                    {session.state.lastOutcome.correct ? 'Bonne réponse.' : `Réponse correcte : ${session.state.lastOutcome.correctAnswer}`}
                  </Text>
                ) : null}
                <Pressable disabled={busy || !answer.trim()} onPress={() => void applyAction('ANSWER')} style={[styles.primary, { backgroundColor: colors.accent }, (busy || !answer.trim()) && styles.disabled]}>
                  <Text style={[styles.primaryText, { color: colors.accentText }]}>Valider</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.question, { color: colors.text }]}>Partie terminée</Text>
                <Text style={[styles.copy, { color: colors.muted }]}>Score final : {session.result?.score ?? session.state.score} · {session.result?.correctAnswers ?? session.state.score} bonne(s) réponse(s).</Text>
                <Pressable disabled={busy} onPress={() => void newGame()} style={[styles.primary, { backgroundColor: colors.accent }, busy && styles.disabled]}>
                  <Text style={[styles.primaryText, { color: colors.accentText }]}>Rejouer</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {guest ? (
          <View style={styles.revokeBlock}>
            <Text style={[styles.copy, { color: colors.muted }]}>Terminer la session demande d’abord au serveur de la révoquer. En cas d’échec réseau, le credential reste sur cet appareil pour pouvoir réessayer.</Text>
            <Pressable disabled={busy} onPress={() => void resetGuest()} style={[styles.secondary, { borderColor: colors.border }, busy && styles.disabled]}>
              <Text style={{ color: colors.muted }}>Terminer et effacer la session invitée</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  content: { padding: 22, gap: 14 },
  back: { fontWeight: '800' },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginTop: 8 },
  title: { fontSize: 34, fontWeight: '900' },
  copy: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 14 },
  cardTitle: { fontSize: 19, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 16, minHeight: 50, paddingHorizontal: 14, fontSize: 17 },
  label: { fontSize: 13, fontWeight: '700' },
  option: { borderWidth: 1, borderRadius: 14, padding: 14 },
  confirmRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, marginTop: 1 },
  confirmText: { flex: 1, lineHeight: 20 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { fontWeight: '900' },
  secondary: { borderWidth: 1, borderRadius: 16, padding: 13, alignItems: 'center' },
  revokeBlock: { gap: 8 },
  disabled: { opacity: 0.45 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  score: { fontSize: 24, fontWeight: '900' },
  round: { fontWeight: '800' },
  question: { fontSize: 32, fontWeight: '900', textAlign: 'center', paddingVertical: 18 },
  error: { lineHeight: 20 }
});
