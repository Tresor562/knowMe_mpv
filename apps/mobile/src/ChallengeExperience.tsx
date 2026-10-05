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
import { useAppearance } from './AppearanceProvider';
import { BrandMark, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

type Visibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
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
  version: number;
};
type Answer = {
  id: string;
  questionId: string;
  value: string;
};
type Participant = {
  id: string;
  userId: string;
  challengeVersion: number;
  completedAt?: string | null;
  user: Person;
  answers?: Answer[];
};
type VersionSnapshot = {
  id: string;
  version: number;
  title: string;
  visibility: Visibility;
  questionCount: number;
  changeReason?: string | null;
  createdAt: string;
};
type RewardResult = {
  event: {
    status: 'AWARDED' | 'REJECTED' | 'IGNORED';
    amount: number;
    explanation?: string | null;
  };
  replayed: boolean;
};
type Challenge = {
  id: string;
  creatorId: string;
  title: string;
  description?: string | null;
  visibility: Visibility;
  status: string;
  currentVersion: number;
  viewerVersion?: number;
  isCurrentVersion?: boolean;
  canEdit?: boolean;
  canAnswer?: boolean;
  createdAt: string;
  creator?: Person;
  questions: Question[];
  participants: Participant[];
  versions?: VersionSnapshot[];
};

type Submission = Participant & { reward?: RewardResult | null };

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function Button({
  title,
  onPress,
  disabled = false,
  danger = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
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
          backgroundColor: danger ? 'transparent' : colors.accent,
          borderColor: danger ? colors.danger : colors.accent
        },
        danger && { borderWidth: 1 },
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text style={[styles.buttonText, { color: danger ? colors.danger : colors.accentText }]}>{title}</Text>
    </Pressable>
  );
}

function VisibilityPicker({ value, onChange }: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  const { colors, visual } = useAppearance();
  const choices: Array<[Visibility, string]> = [
    ['PRIVATE', 'Privé'],
    ['FRIENDS', 'Amis'],
    ['PUBLIC', 'Public']
  ];
  return (
    <View style={styles.visibilityRow}>
      {choices.map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          style={[
            styles.visibilityChoice,
            {
              backgroundColor: value === key ? colors.surfaceRaised : colors.backgroundAccent,
              borderColor: value === key ? colors.accent : colors.border,
              borderRadius: visual.controlRadius
            }
          ]}
        >
          <Text style={[styles.visibilityText, { color: value === key ? colors.accent : colors.muted }]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChallengeDetail({
  challengeId,
  userId,
  onBack,
  onChanged
}: {
  challengeId: string;
  userId: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const { colors, visual } = useAppearance();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuestions, setEditQuestions] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('PRIVATE');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Challenge>(`/challenges/${challengeId}`);
      setChallenge(data);
      const participant = data.participants.find((item) => item.userId === userId);
      setAnswers(
        Object.fromEntries(
          (participant?.answers ?? []).map((answer) => [answer.questionId, answer.value])
        ) as Record<string, string>
      );
      setEditTitle(data.title);
      setEditDescription(data.description ?? '');
      setEditQuestions(data.questions.map((question) => question.prompt).join('\n'));
      setEditVisibility(data.visibility);
    } catch (cause) {
      Alert.alert('Défi indisponible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setLoading(false);
    }
  }, [challengeId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!challenge || !participant || saving || !challenge.canAnswer) return;
    const payload = challenge.questions
      .map((question) => ({
        questionId: question.id,
        value: answers[question.id]?.trim() ?? ''
      }))
      .filter((answer) => answer.value.length > 0);

    if (!payload.length) {
      Alert.alert('Aucune réponse', 'Réponds au moins à une question avant d’enregistrer.');
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<Submission>(`/challenges/${challenge.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload })
      });
      await Promise.all([load(), onChanged()]);
      const reward = result.reward?.event;
      Alert.alert(
        payload.length === challenge.questions.length
          ? 'Défi complété'
          : 'Progression enregistrée',
        reward?.status === 'AWARDED'
          ? `Toutes tes réponses sont enregistrées. +${reward.amount} KnowCoins.`
          : reward?.explanation || 'Ta progression a été enregistrée sur le serveur.'
      );
    } catch (cause) {
      Alert.alert('Enregistrement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setSaving(false);
    }
  }

  async function publishVersion() {
    if (!challenge?.canEdit || saving) return;
    const questions = editQuestions
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (editTitle.trim().length < 3 || !questions.length || editReason.trim().length < 3) {
      Alert.alert(
        'Version incomplète',
        'Ajoute un titre, au moins une question et un motif de modification.'
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<Challenge>(`/challenges/${challenge.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: challenge.currentVersion,
          title: editTitle.trim(),
          description: editDescription.trim(),
          visibility: editVisibility,
          questions,
          changeReason: editReason.trim()
        })
      });
      setChallenge(updated);
      setEditing(false);
      setEditReason('');
      await onChanged();
      Alert.alert(
        `Version ${updated.currentVersion} publiée`,
        'Les anciennes participations et réponses sont restées intactes.'
      );
    } catch (cause) {
      Alert.alert('Publication impossible', errorMessage(cause, 'Recharge le défi et réessaie.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmClose() {
    Alert.alert(
      'Clôturer le défi ?',
      'Les participants ne pourront plus rejoindre le défi, répondre ou publier une nouvelle version.',
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.muted, { color: colors.muted }]}>
          {loading ? 'Chargement du défi…' : 'Défi introuvable.'}
        </Text>
        <Button title="Retour" onPress={onBack} />
      </View>
    );
  }

  const isCreator = challenge.creatorId === userId;
  const isActive = challenge.status === 'ACTIVE';
  const viewerVersion = challenge.viewerVersion ?? challenge.currentVersion;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>DÉFI KNOWME</Text>
          <Text style={[styles.heading, { color: colors.text }]}>{challenge.title}</Text>
        </View>
        <Button title="Retour" onPress={onBack} />
      </View>

      {challenge.isCurrentVersion === false && (
        <View style={[styles.historyBanner, { backgroundColor: colors.surfaceRaised, borderColor: '#F4C95D', borderRadius: visual.cardRadius }]}>
          <Text style={styles.historyTitle}>Partie historique · v{viewerVersion}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            La version actuelle est la v{challenge.currentVersion}. Tes réponses restent
            attachées à leur version d’origine.
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        {challenge.description ? (
          <Text style={[styles.description, { color: colors.text }]}>{challenge.description}</Text>
        ) : null}
        <View style={styles.badgesRow}>
          <Text style={[styles.badge, isActive ? styles.activeBadge : styles.closedBadge]}>
            {challenge.status}
          </Text>
          <Text style={styles.badge}>v{viewerVersion}</Text>
          <Text style={styles.badge}>{challenge.visibility}</Text>
          <Text style={styles.badge}>{challenge.questions.length} question(s)</Text>
        </View>
        {challenge.creator && (
          <Text style={[styles.muted, { color: colors.muted }]}>
            Créé par {challenge.creator.displayName} (@{challenge.creator.username})
          </Text>
        )}
        {!participant && isActive && (
          <Button
            title={joining ? 'Participation…' : `Rejoindre la version ${challenge.currentVersion}`}
            disabled={joining}
            onPress={() => void join()}
          />
        )}
        {participant && (
          <Text style={[styles.success, { color: colors.accent }]}>
            Version de ta participation : v{participant.challengeVersion} ·{' '}
            {participant.completedAt
              ? 'réponses complètes'
              : `${filledCount}/${challenge.questions.length} réponse(s)`}
          </Text>
        )}
        {isCreator && isActive && (
          <>
            <Button
              title={editing ? 'Fermer l’éditeur' : 'Créer une nouvelle version'}
              onPress={() => setEditing((value) => !value)}
            />
            <Button
              title={closing ? 'Clôture…' : 'Clôturer le défi'}
              disabled={closing}
              danger
              onPress={confirmClose}
            />
          </>
        )}
      </View>

      {editing && challenge.canEdit && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Version {challenge.currentVersion + 1}</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            La version actuelle ne sera pas modifiée. Cette publication crée un nouvel
            instantané complet.
          </Text>
          <TextInput
            value={editTitle}
            onChangeText={setEditTitle}
            maxLength={100}
            placeholder="Titre"
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
            value={editDescription}
            onChangeText={setEditDescription}
            maxLength={500}
            multiline
            placeholder="Description"
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
          <VisibilityPicker value={editVisibility} onChange={setEditVisibility} />
          <TextInput
            value={editQuestions}
            onChangeText={setEditQuestions}
            multiline
            placeholder="Une question par ligne"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={[
              styles.input,
              styles.questionsInput,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                color: colors.text,
                borderRadius: visual.inputRadius
              }
            ]}
          />
          <TextInput
            value={editReason}
            onChangeText={setEditReason}
            multiline
            maxLength={500}
            placeholder="Motif de la modification"
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
            title={saving ? 'Publication…' : `Publier la v${challenge.currentVersion + 1}`}
            disabled={saving}
            onPress={() => void publishVersion()}
          />
        </View>
      )}

      {participant && challenge.canAnswer && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tes réponses · v{participant.challengeVersion}</Text>
          {challenge.questions.map((question, index) => (
            <View key={question.id} style={[styles.questionBlock, { borderTopColor: colors.border }]}>
              <Text style={[styles.questionLabel, { color: colors.accent }]}>Question {index + 1}</Text>
              <Text style={[styles.question, { color: colors.text }]}>{question.prompt}</Text>
              <TextInput
                editable={isActive}
                multiline
                maxLength={1000}
                value={answers[question.id] ?? ''}
                onChangeText={(value) =>
                  setAnswers((current) => ({ ...current, [question.id]: value }))
                }
                placeholder="Ta réponse…"
                placeholderTextColor={colors.muted}
                selectionColor={colors.accent}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundAccent,
                    borderColor: colors.border,
                    color: colors.text,
                    borderRadius: visual.inputRadius
                  },
                  !isActive && styles.disabledInput
                ]}
              />
            </View>
          ))}
          {isActive && (
            <Button
              title={
                saving
                  ? 'Enregistrement…'
                  : filledCount === challenge.questions.length
                    ? 'Enregistrer toutes les réponses'
                    : 'Enregistrer ma progression'
              }
              disabled={saving || filledCount === 0}
              onPress={() => void saveAnswers()}
            />
          )}
        </View>
      )}

      {participant && !challenge.canAnswer && isActive && (
        <View style={[styles.historyBanner, { backgroundColor: colors.surfaceRaised, borderColor: '#F4C95D', borderRadius: visual.cardRadius }]}>
          <Text style={styles.historyTitle}>Participation conservée</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            Cette participation est figée sur la v{participant.challengeVersion} et ne peut
            pas être déplacée automatiquement.
          </Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Participants</Text>
      {challenge.participants.map((item) => (
        <View key={item.id} style={[styles.participantCard, { backgroundColor: colors.backgroundAccent, borderRadius: visual.controlRadius }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentText }]}>
              {item.user.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: colors.text }]}>{item.user.displayName}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>
              @{item.user.username} · v{item.challengeVersion}
            </Text>
          </View>
          <Text style={[item.completedAt ? styles.success : styles.muted, { color: item.completedAt ? colors.accent : colors.muted }]}>
            {item.completedAt ? 'Terminé' : 'En cours'}
          </Text>
        </View>
      ))}

      {isCreator && Boolean(challenge.versions?.length) && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique immuable</Text>
          {challenge.versions?.map((version) => (
            <View key={version.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Version {version.version}
                  {version.version === challenge.currentVersion ? ' · actuelle' : ''}
                </Text>
                <Text style={[styles.muted, { color: colors.muted }]}>{version.questionCount} question(s)</Text>
              </View>
              <Text style={[styles.muted, { color: colors.muted }]}>{version.visibility}</Text>
              {version.changeReason ? (
                <Text style={[styles.description, { color: colors.text }]}>{version.changeReason}</Text>
              ) : null}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

export function ChallengeExperience({ userId }: { userId: string }) {
  const { colors, visual } = useAppearance();
  const [items, setItems] = useState<Challenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
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

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const prompts = questions
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!title.trim() || !prompts.length || creating) return;
    setCreating(true);
    try {
      const created = await apiFetch<Challenge>('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
          questions: prompts
        })
      });
      setTitle('');
      setDescription('');
      setQuestions('');
      setVisibility('PRIVATE');
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
    >
      <GlassSurface strength="soft" borderRadius={28} style={styles.challengeHeader}>
        <View style={styles.challengeBrand}>
          <BrandMark size={31} />
          <View>
            <Text style={[styles.heading, { color: colors.text }]}>Défis</Text>
            <Text style={[styles.challengeSub, { color: colors.muted }]}>Le cœur de KnowMe.</Text>
          </View>
        </View>
        <GlassSurface strength="soft" borderRadius={21} style={styles.challengeHeaderIcon}>
          <KnowMeIcon name="challenge" size={23} color={colors.secondary} />
        </GlassSurface>
      </GlassSurface>

      <View style={[styles.card, styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <View style={styles.createTitleRow}>
          <View style={[styles.createIcon, { backgroundColor: colors.accent }]}>
            <KnowMeIcon name="create" size={20} color={colors.accentText} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Créer un défi</Text>
            <Text style={[styles.createHint, { color: colors.muted }]}>Pose les questions qui comptent vraiment.</Text>
          </View>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="Titre du défi"
          placeholderTextColor={colors.muted}
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
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          placeholder="Description facultative"
          placeholderTextColor={colors.muted}
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
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        <TextInput
          value={questions}
          onChangeText={setQuestions}
          multiline
          placeholder={'Une question par ligne\nQuel est mon plus grand rêve ?'}
          placeholderTextColor={colors.muted}
          style={[
          styles.input,
          styles.questionsInput,
          {
            backgroundColor: colors.backgroundAccent,
            borderColor: colors.border,
            color: colors.text,
            borderRadius: visual.inputRadius
          }
        ]}
        />
        <Button
          title={creating ? 'Création…' : 'Créer et répondre'}
          disabled={creating || !title.trim() || !questions.trim()}
          onPress={() => void create()}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes défis</Text>
      {items.map((item) => {
        const participant = item.participants.find((entry) => entry.userId === userId);
        return (
          <PressScale key={item.id} onPress={() => setSelectedId(item.id)} style={[styles.card, styles.challengeListCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
            <View style={styles.headerRow}>
              <View style={styles.challengeListTitleRow}>
                <View style={[styles.challengeMiniIcon, { backgroundColor: colors.backgroundAccent }]}>
                  <KnowMeIcon name="challenge" size={18} color={colors.secondary} />
                </View>
                <Text style={[styles.title, styles.flex, { color: colors.text }]}>{item.title}</Text>
              </View>
              <Text
                style={[
                  styles.badge,
                  item.status === 'ACTIVE' ? styles.activeBadge : styles.closedBadge
                ]}
              >
                {item.status}
              </Text>
            </View>
            {item.description ? <Text style={[styles.description, { color: colors.text }]}>{item.description}</Text> : null}
            <Text style={[styles.muted, { color: colors.muted }]}>
              v{item.currentVersion} · {item.visibility} · {item.questions.length} question(s) ·{' '}
              {item.participants.length} participant(s)
            </Text>
            <Text style={[participant?.completedAt ? styles.success : styles.muted, { color: participant?.completedAt ? colors.accent : colors.muted }]}>
              {participant?.completedAt
                ? `Tu as terminé la v${participant.challengeVersion}.`
                : participant
                  ? `Ta participation est sur la v${participant.challengeVersion}.`
                  : 'Ouvre le défi pour le rejoindre.'}
            </Text>
          </PressScale>
        );
      })}
      {!items.length && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
          <Text style={[styles.muted, { color: colors.muted }]}>Aucun défi pour le moment. Crée le premier.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  challengeHeader: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  challengeBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  challengeSub: { fontSize: 11.5, marginTop: 1 },
  challengeHeaderIcon: { width: 43, height: 43, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  createCard: { borderRadius: 26, padding: 16 },
  createTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  createIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  createHint: { fontSize: 11.5, marginTop: 2 },
  challengeListCard: { borderRadius: 22 },
  challengeListTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  challengeMiniIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 23, fontWeight: '900', letterSpacing: -0.45 },
  sectionTitle: { fontSize: 21, fontWeight: '900' },
  title: { fontSize: 17, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22 },
  muted: { lineHeight: 20 },
  success: { fontWeight: '800' },
  card: { borderWidth: 1, padding: 18, gap: 12 },
  historyBanner: { borderWidth: 1, padding: 16, gap: 8 },
  historyTitle: { color: '#f4c95d', fontSize: 17, fontWeight: '900' },
  participantCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  questionBlock: { gap: 8, borderTopWidth: 1, paddingTop: 14 },
  questionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  question: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  input: { minHeight: 52, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  questionsInput: { minHeight: 128 },
  disabledInput: { opacity: 0.65 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden', fontSize: 12, fontWeight: '800' },
  activeBadge: { color: '#7A5CFF' },
  closedBadge: { color: '#FF6B73' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', fontSize: 17 },
  button: { paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontWeight: '900' },
  buttonMuted: { opacity: 0.45 },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityChoice: { flex: 1, paddingVertical: 11, alignItems: 'center', borderWidth: 1 },
  visibilityChoiceActive: {},
  visibilityText: { fontWeight: '800' },
  visibilityTextActive: {}
});
