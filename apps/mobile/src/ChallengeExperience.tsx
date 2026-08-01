import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Person = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

type Question = {
  id: string;
  prompt: string;
  position: number;
};

type Answer = {
  id: string;
  questionId: string;
  value: string;
};

type Participant = {
  id: string;
  userId: string;
  completedAt?: string | null;
  user: Person;
  answers?: Answer[];
};

type Challenge = {
  id: string;
  creatorId: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  creator?: Person;
  questions: Question[];
  participants: Participant[];
};

function errorMessage(cause: unknown, fallback: string) {
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

function ChallengeDetail({ challengeId, userId, onBack, onChanged }: {
  challengeId: string;
  userId: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Challenge>(`/challenges/${challengeId}`);
      setChallenge(data);
      const participant = data.participants.find((item) => item.userId === userId);
      const existing = Object.fromEntries(
        (participant?.answers ?? []).map((answer) => [answer.questionId, answer.value])
      ) as Record<string, string>;
      setAnswers(existing);
    } catch (cause) {
      Alert.alert('Défi indisponible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setLoading(false);
    }
  }, [challengeId, userId]);

  useEffect(() => { void load(); }, [load]);

  const participant = useMemo(
    () => challenge?.participants.find((item) => item.userId === userId),
    [challenge, userId]
  );

  const filledCount = challenge
    ? challenge.questions.filter((question) => Boolean(answers[question.id]?.trim())).length
    : 0;

  async function join() {
    if (joining) return;
    setJoining(true);
    try {
      await apiFetch(`/challenges/${challengeId}/join`, { method: 'POST' });
      await Promise.all([load(), onChanged()]);
    } catch (cause) {
      Alert.alert('Participation impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setJoining(false);
    }
  }

  async function saveAnswers() {
    if (!challenge || !participant || saving) return;
    const payload = challenge.questions
      .map((question) => ({ questionId: question.id, value: answers[question.id]?.trim() ?? '' }))
      .filter((answer) => answer.value.length > 0);

    if (!payload.length) {
      Alert.alert('Aucune réponse', 'Réponds au moins à une question avant d’enregistrer.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/challenges/${challenge.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload })
      });
      await Promise.all([load(), onChanged()]);
      Alert.alert(
        payload.length === challenge.questions.length ? 'Défi complété' : 'Progression enregistrée',
        payload.length === challenge.questions.length
          ? 'Toutes tes réponses sont enregistrées.'
          : 'Tu pourras revenir compléter les autres réponses.'
      );
    } catch (cause) {
      Alert.alert('Enregistrement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmClose() {
    Alert.alert(
      'Clôturer le défi ?',
      'Les participants ne pourront plus rejoindre le défi ni modifier leurs réponses.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Clôturer', style: 'destructive', onPress: () => void closeChallenge() }
      ]
    );
  }

  async function closeChallenge() {
    if (!challenge || closing) return;
    setClosing(true);
    try {
      await apiFetch(`/challenges/${challenge.id}/complete`, { method: 'PATCH' });
      await Promise.all([load(), onChanged()]);
    } catch (cause) {
      Alert.alert('Clôture impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setClosing(false);
    }
  }

  if (loading || !challenge) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{loading ? 'Chargement du défi…' : 'Défi introuvable.'}</Text>
        <Button title="Retour" onPress={onBack} />
      </View>
    );
  }

  const isCreator = challenge.creatorId === userId;
  const isActive = challenge.status === 'ACTIVE';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>DÉFI KNOWME</Text>
          <Text style={styles.heading}>{challenge.title}</Text>
        </View>
        <Button title="Retour" onPress={onBack} />
      </View>

      <View style={styles.card}>
        {challenge.description ? <Text style={styles.description}>{challenge.description}</Text> : null}
        <View style={styles.badgesRow}>
          <Text style={[styles.badge, isActive ? styles.activeBadge : styles.closedBadge]}>{challenge.status}</Text>
          <Text style={styles.badge}>{challenge.questions.length} question(s)</Text>
          <Text style={styles.badge}>{challenge.participants.length} participant(s)</Text>
        </View>
        {challenge.creator && <Text style={styles.muted}>Créé par {challenge.creator.displayName} (@{challenge.creator.username})</Text>}
        {!participant && isActive && <Button title={joining ? 'Participation…' : 'Rejoindre ce défi'} disabled={joining} onPress={() => void join()} />}
        {participant && <Text style={styles.success}>{participant.completedAt ? 'Tes réponses sont complètes.' : `${filledCount}/${challenge.questions.length} réponse(s) renseignée(s).`}</Text>}
        {isCreator && isActive && <Button title={closing ? 'Clôture…' : 'Clôturer le défi'} disabled={closing} danger onPress={confirmClose} />}
      </View>

      {participant && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tes réponses</Text>
          {challenge.questions.map((question, index) => (
            <View key={question.id} style={styles.questionBlock}>
              <Text style={styles.questionLabel}>Question {index + 1}</Text>
              <Text style={styles.question}>{question.prompt}</Text>
              <TextInput
                editable={isActive}
                multiline
                maxLength={500}
                value={answers[question.id] ?? ''}
                onChangeText={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                placeholder="Ta réponse…"
                placeholderTextColor="#789187"
                style={[styles.input, !isActive && styles.disabledInput]}
              />
            </View>
          ))}
          {isActive && (
            <Button
              title={saving ? 'Enregistrement…' : filledCount === challenge.questions.length ? 'Enregistrer toutes les réponses' : 'Enregistrer ma progression'}
              disabled={saving || filledCount === 0}
              onPress={() => void saveAnswers()}
            />
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Participants</Text>
      {challenge.participants.map((item) => (
        <View key={item.id} style={styles.participantCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{item.user.displayName.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.title}>{item.user.displayName}</Text>
            <Text style={styles.muted}>@{item.user.username}</Text>
          </View>
          <Text style={item.completedAt ? styles.success : styles.muted}>{item.completedAt ? 'Terminé' : `${item.answers?.length ?? 0}/${challenge.questions.length}`}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function ChallengeExperience({ userId }: { userId: string }) {
  const [items, setItems] = useState<Challenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await apiFetch<Challenge[]>('/challenges'));
    } catch (cause) {
      Alert.alert('Défis indisponibles', errorMessage(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    const prompts = questions.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!title.trim() || !prompts.length || creating) return;
    setCreating(true);
    try {
      const created = await apiFetch<Challenge>('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions: prompts
        })
      });
      setTitle('');
      setDescription('');
      setQuestions('');
      await load();
      setSelectedId(created.id);
    } catch (cause) {
      Alert.alert('Création impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setCreating(false);
    }
  }

  if (selectedId) {
    return (
      <ChallengeDetail
        challengeId={selectedId}
        userId={userId}
        onBack={() => setSelectedId(null)}
        onChanged={load}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
    >
      <Text style={styles.eyebrow}>LE CŒUR DE KNOWME</Text>
      <Text style={styles.heading}>Défis</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Créer un défi</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Titre du défi" placeholderTextColor="#789187" style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="Description facultative" placeholderTextColor="#789187" style={styles.input} />
        <TextInput
          value={questions}
          onChangeText={setQuestions}
          multiline
          placeholder={'Une question par ligne\nQuel est mon plus grand rêve ?'}
          placeholderTextColor="#789187"
          style={[styles.input, styles.questionsInput]}
        />
        <Button title={creating ? 'Création…' : 'Créer et répondre'} disabled={creating || !title.trim() || !questions.trim()} onPress={() => void create()} />
      </View>

      <Text style={styles.sectionTitle}>Mes défis</Text>
      {items.map((item) => {
        const participant = item.participants.find((entry) => entry.userId === userId);
        return (
          <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, styles.flex]}>🎯 {item.title}</Text>
              <Text style={[styles.badge, item.status === 'ACTIVE' ? styles.activeBadge : styles.closedBadge]}>{item.status}</Text>
            </View>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            <Text style={styles.muted}>{item.questions.length} question(s) · {item.participants.length} participant(s)</Text>
            <Text style={participant?.completedAt ? styles.success : styles.muted}>
              {participant?.completedAt ? 'Tu as terminé ce défi.' : 'Ouvre le défi pour répondre ou suivre la progression.'}
            </Text>
          </Pressable>
        );
      })}
      {!items.length && <View style={styles.card}><Text style={styles.muted}>Aucun défi pour le moment. Crée le premier.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  eyebrow: { color: '#45e6bd', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#f4fff9', fontSize: 30, fontWeight: '900', marginTop: 4 },
  sectionTitle: { color: '#f4fff9', fontSize: 21, fontWeight: '900' },
  title: { color: '#f4fff9', fontSize: 17, fontWeight: '800' },
  description: { color: '#d5e8df', fontSize: 15, lineHeight: 22 },
  muted: { color: '#91a79e' },
  success: { color: '#45e6bd', fontWeight: '800' },
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  participantCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0d1f19', borderRadius: 18, padding: 14 },
  questionBlock: { gap: 8, borderTopColor: '#1c3a31', borderTopWidth: 1, paddingTop: 14 },
  questionLabel: { color: '#45e6bd', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  question: { color: '#f4fff9', fontSize: 17, lineHeight: 24, fontWeight: '700' },
  input: { minHeight: 52, backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  questionsInput: { minHeight: 110 },
  disabledInput: { opacity: 0.65 },
  button: { backgroundColor: '#45e6bd', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#052017', fontWeight: '900' },
  dangerButton: { backgroundColor: 'transparent', borderColor: '#ff9d66', borderWidth: 1 },
  dangerText: { color: '#ff9d66' },
  buttonMuted: { opacity: 0.45 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { color: '#b6c8c0', backgroundColor: '#1b3b31', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  activeBadge: { color: '#45e6bd' },
  closedBadge: { color: '#ffb785' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1b3b31', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#45e6bd', fontWeight: '900' }
});
