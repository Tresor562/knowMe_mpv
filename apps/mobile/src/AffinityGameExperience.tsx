import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Preference = {
  invitationsEnabled: boolean;
  friendsOnly: boolean;
  defaultShareAnswers: boolean;
  version: number;
};

type Summary = {
  title: string;
  overallScore: number;
  categories: Array<{
    key: string;
    label: string;
    score: number;
    exactMatches: number;
    questionCount: number;
  }>;
  explanations: string[];
  disclaimer: string;
  detailedAnswersShared: boolean;
  answerDetails?: Array<{
    questionKey: string;
    prompt: string;
    firstChoice: string;
    secondChoice: string;
  }>;
};

type Session = {
  id: string;
  game: { key: string; name: string; description: string };
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'CANCELLED' | 'EXPIRED';
  sequence: number;
  state: {
    phase: 'CONSENT' | 'QUESTIONS' | 'COMPLETED';
    consentCount: number;
    questionIndex: number;
    questionCount: number;
    question: {
      key: string;
      category: string;
      prompt: string;
      options: string[];
    } | null;
    summary: Summary | null;
    disclaimer: string;
  };
  currentTurnPosition: number | null;
  result: Summary | Record<string, unknown> | null;
  viewerPosition: number;
  yourTurn: boolean;
  participants: Array<{
    userId: string;
    position: number;
    status: string;
    user: { displayName: string; username: string } | null;
  }>;
};

type Replay = {
  verified: boolean;
  privacyRedacted: boolean;
  detailedAnswersShared: boolean;
  actions: Array<{ sequence: number; actionType: string }>;
};

function operationKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function AffinityGameExperience() {
  const { colors } = useAppearance();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [shareAnswers, setShareAnswers] = useState(false);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const viewer = useMemo(
    () =>
      selected?.participants.find(
        (participant) => participant.position === selected.viewerPosition
      ),
    [selected]
  );

  async function refresh() {
    const [nextPreference, allSessions] = await Promise.all([
      apiFetch<Preference>('/games/affinity/preferences'),
      apiFetch<Session[]>('/games/sessions')
    ]);
    setPreference(nextPreference);
    setShareAnswers((current) =>
      preference ? current : nextPreference.defaultShareAnswers
    );
    setSessions(
      allSessions.filter((session) => session.game.key === 'affinity-mirror')
    );
    if (selected) {
      setSelected(await apiFetch<Session>(`/games/sessions/${selected.id}`));
    }
  }

  useEffect(() => {
    void refresh().catch(() =>
      setMessage('Chargement du Miroir d’affinité impossible.')
    );
  }, []);

  async function execute(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await task();
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  function updatePreference(patch: Partial<Preference>) {
    void execute(async () => {
      const next = await apiFetch<Preference>('/games/affinity/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setPreference(next);
      setShareAnswers(next.defaultShareAnswers);
    });
  }

  function create() {
    const opponent = username.trim().replace(/^@/, '');
    if (opponent.length < 3) return;
    void execute(async () => {
      setSelected(
        await apiFetch<Session>('/games/sessions', {
          method: 'POST',
          body: JSON.stringify({
            gameKey: 'affinity-mirror',
            opponentUsernames: [opponent],
            idempotencyKey: operationKey('mobile-affinity-create')
          })
        })
      );
      setUsername('');
      setReplay(null);
      setMessage('Invitation créée. Les deux consentements restent nécessaires.');
    });
  }

  function open(sessionId: string) {
    void execute(async () => {
      setSelected(await apiFetch<Session>(`/games/sessions/${sessionId}`));
      setReplay(null);
    });
  }

  function join() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<Session>(`/games/sessions/${selected.id}/join`, {
          method: 'POST'
        })
      );
    });
  }

  function consent() {
    if (!selected?.yourTurn) return;
    void execute(async () => {
      setSelected(
        await apiFetch<Session>(`/games/sessions/${selected.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'CONSENT',
            payload: { accepted: true, shareAnswers },
            expectedSequence: selected.sequence,
            idempotencyKey: operationKey(
              `mobile-affinity-consent-${selected.sequence + 1}`
            )
          })
        })
      );
    });
  }

  function answer(option: number) {
    if (!selected?.yourTurn || selected.state.phase !== 'QUESTIONS') return;
    void execute(async () => {
      setSelected(
        await apiFetch<Session>(`/games/sessions/${selected.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'ANSWER',
            payload: { option },
            expectedSequence: selected.sequence,
            idempotencyKey: operationKey(
              `mobile-affinity-answer-${selected.sequence + 1}`
            )
          })
        })
      );
    });
  }

  function leave() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<Session>(`/games/sessions/${selected.id}/abandon`, {
          method: 'POST'
        })
      );
    });
  }

  function verifyReplay() {
    if (!selected) return;
    void execute(async () => {
      setReplay(
        await apiFetch<Replay>(`/games/sessions/${selected.id}/replay`)
      );
    });
  }

  const card = { backgroundColor: colors.surface, borderColor: colors.border };
  const raised = {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border
  };
  const summary =
    selected?.state.summary ??
    (selected?.result && 'overallScore' in selected.result
      ? (selected.result as Summary)
      : null);

  return (
    <View style={[styles.card, card]}>
      <Text style={[styles.title, { color: colors.text }]}>Miroir d’affinité</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Six préférences comparées volontairement. Le résultat ne mesure ni la compatibilité,
        ni la qualité, ni l’avenir d’une relation.
      </Text>

      {preference ? (
        <View style={[styles.preferenceBox, raised]}>
          <PreferenceRow
            label="Accepter les invitations"
            value={preference.invitationsEnabled}
            disabled={busy}
            onChange={(value) => updatePreference({ invitationsEnabled: value })}
            textColor={colors.text}
          />
          <PreferenceRow
            label="Amis uniquement"
            value={preference.friendsOnly}
            disabled={busy}
            onChange={(value) => updatePreference({ friendsOnly: value })}
            textColor={colors.text}
          />
          <PreferenceRow
            label="Proposer le partage détaillé"
            value={preference.defaultShareAnswers}
            disabled={busy}
            onChange={(value) =>
              updatePreference({ defaultShareAnswers: value })
            }
            textColor={colors.text}
          />
        </View>
      ) : null}

      <View style={styles.row}>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          maxLength={30}
          placeholder="Pseudo de ton ami"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.background,
              borderColor: colors.border
            }
          ]}
        />
        <Pressable
          disabled={busy || username.trim().length < 3}
          onPress={create}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            (pressed || busy) && styles.muted
          ]}
        >
          <Text style={{ color: colors.accentText, fontWeight: '900' }}>
            Inviter
          </Text>
        </Pressable>
      </View>

      <View style={styles.wrap}>
        {sessions.map((session) => (
          <Pressable
            key={session.id}
            disabled={busy}
            onPress={() => open(session.id)}
            style={[
              styles.sessionPill,
              raised,
              selected?.id === session.id && { borderColor: colors.accent }
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {session.game.name}
            </Text>
            <Text
              style={{
                color: session.yourTurn ? colors.secondary : colors.muted,
                fontSize: 12
              }}
            >
              {session.status}{session.yourTurn ? ' · À toi' : ''}
            </Text>
          </Pressable>
        ))}
        {!sessions.length ? (
          <Text style={{ color: colors.muted }}>Aucun instantané.</Text>
        ) : null}
      </View>

      {selected ? (
        <View style={[styles.detail, raised]}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>
            {selected.game.name}
          </Text>
          <Text style={{ color: colors.muted }}>
            {selected.status} · séquence {selected.sequence}
          </Text>

          <View style={styles.wrap}>
            {selected.participants.map((participant) => (
              <View
                key={participant.userId}
                style={[
                  styles.player,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {participant.user?.displayName ?? 'Compte supprimé'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {participant.status}
                </Text>
              </View>
            ))}
          </View>

          {selected.status === 'WAITING' && viewer?.status === 'INVITED' ? (
            <Pressable
              disabled={busy}
              onPress={join}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>
                Rejoindre volontairement
              </Text>
            </Pressable>
          ) : null}

          {selected.status === 'ACTIVE' && selected.state.phase === 'CONSENT' ? (
            <View style={styles.stack}>
              <Text style={{ color: colors.muted }}>{selected.state.disclaimer}</Text>
              {selected.yourTurn ? (
                <>
                  <PreferenceRow
                    label="Partager les réponses seulement si l’autre accepte aussi"
                    value={shareAnswers}
                    disabled={busy}
                    onChange={setShareAnswers}
                    textColor={colors.text}
                  />
                  <Pressable
                    disabled={busy}
                    onPress={consent}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.accent }
                    ]}
                  >
                    <Text
                      style={{ color: colors.accentText, fontWeight: '900' }}
                    >
                      Je consens à participer
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Text style={{ color: colors.muted }}>
                  En attente du consentement de l’autre personne.
                </Text>
              )}
            </View>
          ) : null}

          {selected.status === 'ACTIVE' && selected.state.phase === 'QUESTIONS' ? (
            <View style={styles.stack}>
              <Text style={{ color: colors.muted }}>
                Question {selected.state.questionIndex + 1}/{selected.state.questionCount}
              </Text>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                {selected.state.question?.prompt}
              </Text>
              {selected.yourTurn ? (
                selected.state.question?.options.map((option, index) => (
                  <Pressable
                    key={option}
                    disabled={busy}
                    onPress={() => answer(index)}
                    style={[styles.option, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {option}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>
                  Ta réponse reste cachée pendant le choix de l’autre personne.
                </Text>
              )}
              <Pressable
                disabled={busy}
                onPress={leave}
                style={[styles.secondaryButton, { borderColor: colors.secondary }]}
              >
                <Text style={{ color: colors.secondary, fontWeight: '900' }}>
                  Quitter le jeu
                </Text>
              </Pressable>
            </View>
          ) : null}

          {summary ? (
            <View style={styles.stack}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>
                {summary.title}
              </Text>
              <Text style={{ color: colors.accent, fontSize: 28, fontWeight: '900' }}>
                {summary.overallScore}/100
              </Text>
              {summary.categories.map((category) => (
                <View
                  key={category.key}
                  style={[styles.resultCard, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '900' }}>
                    {category.label} · {category.score}/100
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {category.exactMatches}/{category.questionCount} choix identiques
                  </Text>
                </View>
              ))}
              {summary.explanations.map((explanation) => (
                <Text key={explanation} style={{ color: colors.text }}>
                  {explanation}
                </Text>
              ))}
              <Text style={{ color: colors.secondary, fontWeight: '800' }}>
                {summary.disclaimer}
              </Text>
              {summary.answerDetails?.map((detail) => (
                <View key={detail.questionKey} style={styles.stack}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {detail.prompt}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {detail.firstChoice} · {detail.secondChoice}
                  </Text>
                </View>
              ))}
              <Pressable
                disabled={busy}
                onPress={verifyReplay}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: colors.accentText, fontWeight: '900' }}>
                  Vérifier le replay privé
                </Text>
              </Pressable>
              {replay ? (
                <Text
                  style={{
                    color: replay.verified ? colors.secondary : colors.danger,
                    fontWeight: '800'
                  }}
                >
                  {replay.verified ? 'Replay vérifié' : 'Replay invalide'} ·{' '}
                  {replay.privacyRedacted
                    ? 'réponses expurgées'
                    : 'détails partagés mutuellement'}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {message ? (
        <Text style={{ color: colors.secondary, fontWeight: '800' }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function PreferenceRow({
  label,
  value,
  disabled,
  onChange,
  textColor
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  textColor: string;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={{ color: textColor, flex: 1 }}>{label}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '900' },
  detailTitle: { fontSize: 17, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 10 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13
  },
  primaryButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: 'center'
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  preferenceBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  sessionPill: { minWidth: 135, borderWidth: 1, borderRadius: 14, padding: 11 },
  detail: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  player: { borderWidth: 1, borderRadius: 13, padding: 10 },
  option: { borderWidth: 1, borderRadius: 14, padding: 13 },
  resultCard: { borderWidth: 1, borderRadius: 14, padding: 12 },
  muted: { opacity: 0.5 }
});
