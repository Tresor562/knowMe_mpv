import { useEffect, useState } from 'react';
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
  matchmakingEnabled: boolean;
  allowNewPeople: boolean;
};

type MatchStatus = {
  queue: {
    status: string;
    purpose: string;
    pace: string;
  } | null;
  proposal: {
    id: string;
    status: string;
    score: number;
    partner: {
      id: string;
      username: string;
      displayName: string;
    } | null;
    yourDecision: 'ACCEPT' | 'DECLINE' | 'BLOCK' | null;
    explanation: {
      explanations: string[];
      sensitiveCriteriaUsed: false;
      affinityAnswersUsed: false;
      privateMessagesUsed: false;
      preciseLocationUsed: false;
    };
  } | null;
  sensitiveCriteriaUsed: false;
};

type ConnectionStatus = {
  proposalId: string;
  available: boolean;
  expiresAt: string;
  intent: {
    wantsFriendship: boolean;
    wantsConversation: boolean;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  } | null;
  partnerResponded: boolean;
  result: {
    friendshipCreated: boolean;
    conversationCreated: boolean;
    friendshipId: string | null;
    conversationId: string | null;
  };
  privacy: {
    partnerChoicesExposed: false;
    automaticConnectionAllowed: false;
  };
};

const PURPOSES = ['CHAT', 'PLAY', 'LEARN', 'CREATE'] as const;
const PACES = ['REALTIME', 'ASYNC', 'FLEXIBLE'] as const;
const LANGUAGES = ['fr', 'en', 'pt', 'es', 'de', 'it', 'ar'] as const;
const TOPICS = [
  'TECH',
  'MUSIC',
  'ANIME',
  'GAMING',
  'ART',
  'SCIENCE',
  'ENTREPRENEURSHIP',
  'SPORTS',
  'MOVIES',
  'BOOKS',
  'LANGUAGES',
  'COOKING',
  'TRAVEL_IDEAS'
] as const;

function operationKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function SocialMatchmakingExperience() {
  const { colors } = useAppearance();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [status, setStatus] = useState<MatchStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>('LEARN');
  const [pace, setPace] = useState<(typeof PACES)[number]>('FLEXIBLE');
  const [languages, setLanguages] = useState<string[]>(['fr', 'en']);
  const [topics, setTopics] = useState<string[]>(['TECH', 'BOOKS']);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startMinute, setStartMinute] = useState('900');
  const [endMinute, setEndMinute] = useState('1020');
  const [wantsFriendship, setWantsFriendship] = useState(false);
  const [wantsConversation, setWantsConversation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [nextPreference, nextStatus] = await Promise.all([
      apiFetch<Preference>('/social-matchmaking/preferences'),
      apiFetch<MatchStatus>('/social-matchmaking/status')
    ]);
    let nextConnection: ConnectionStatus | null = null;
    if (nextStatus.proposal?.status === 'ACCEPTED') {
      nextConnection = await apiFetch<ConnectionStatus>(
        `/social-matchmaking/proposals/${nextStatus.proposal.id}/connection`
      );
    }
    setPreference(nextPreference);
    setStatus(nextStatus);
    setConnection(nextConnection);
    if (nextConnection?.intent) {
      setWantsFriendship(nextConnection.intent.wantsFriendship);
      setWantsConversation(nextConnection.intent.wantsConversation);
    }
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Chargement du matchmaking impossible.'));
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
      setPreference(
        await apiFetch<Preference>('/social-matchmaking/preferences', {
          method: 'PATCH',
          body: JSON.stringify(patch)
        })
      );
    });
  }

  function toggleValue(
    value: string,
    current: string[],
    maximum: number,
    update: (next: string[]) => void
  ) {
    if (current.includes(value)) {
      if (current.length > 1) update(current.filter((item) => item !== value));
      return;
    }
    if (current.length < maximum) update([...current, value]);
  }

  function join() {
    const day = Number(dayOfWeek);
    const start = Number(startMinute);
    const end = Number(endMinute);
    if (!Number.isInteger(day) || !Number.isInteger(start) || !Number.isInteger(end)) {
      setMessage('Le créneau UTC est invalide.');
      return;
    }
    void execute(async () => {
      setStatus(
        await apiFetch<MatchStatus>('/social-matchmaking/queue', {
          method: 'POST',
          body: JSON.stringify({
            purpose,
            pace,
            languages,
            topics,
            availability: [
              { dayOfWeek: day, startMinute: start, endMinute: end }
            ],
            idempotencyKey: operationKey('mobile-social-match-join')
          })
        })
      );
      setMessage('File rejointe avec uniquement les critères affichés.');
    });
  }

  function leave() {
    void execute(async () => {
      await apiFetch('/social-matchmaking/queue', { method: 'DELETE' });
      setMessage('Tu as quitté la file.');
    });
  }

  function decide(decision: 'ACCEPT' | 'DECLINE' | 'BLOCK') {
    const proposalId = status?.proposal?.id;
    if (!proposalId) return;
    void execute(async () => {
      setStatus(
        await apiFetch<MatchStatus>(
          `/social-matchmaking/proposals/${proposalId}/decision`,
          {
            method: 'POST',
            body: JSON.stringify({
              decision,
              idempotencyKey: operationKey(
                `mobile-social-match-${decision.toLowerCase()}`
              )
            })
          }
        )
      );
    });
  }

  function saveConnectionIntent() {
    const proposalId = status?.proposal?.id;
    if (!proposalId || (!wantsFriendship && !wantsConversation)) return;
    void execute(async () => {
      setConnection(
        await apiFetch<ConnectionStatus>(
          `/social-matchmaking/proposals/${proposalId}/connection/intent`,
          {
            method: 'POST',
            body: JSON.stringify({
              wantsFriendship,
              wantsConversation,
              idempotencyKey: operationKey('mobile-social-connection-intent')
            })
          }
        )
      );
      setMessage('Tes choix privés ont été enregistrés.');
    });
  }

  function revokeConnectionIntent() {
    const proposalId = status?.proposal?.id;
    if (!proposalId) return;
    void execute(async () => {
      setConnection(
        await apiFetch<ConnectionStatus>(
          `/social-matchmaking/proposals/${proposalId}/connection/revoke`,
          {
            method: 'POST',
            body: JSON.stringify({
              idempotencyKey: operationKey('mobile-social-connection-revoke')
            })
          }
        )
      );
      setWantsFriendship(false);
      setWantsConversation(false);
      setMessage('Ton intention a été révoquée.');
    });
  }

  const card = { backgroundColor: colors.surface, borderColor: colors.border };
  const raised = {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border
  };
  const canJoin =
    preference?.matchmakingEnabled &&
    preference.allowNewPeople &&
    topics.length > 0 &&
    languages.length > 0 &&
    Number(endMinute) - Number(startMinute) >= 30;
  const proposal = status?.proposal ?? null;
  const connectionExecuted = Boolean(
    connection?.result.friendshipCreated || connection?.result.conversationCreated
  );

  return (
    <View style={[styles.card, card]}>
      <Text style={[styles.title, { color: colors.text }]}>Rencontres sociales</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Appariement volontaire fondé uniquement sur les critères affichés. Les réponses
        d’affinité, messages privés, données sensibles et localisations précises ne sont
        jamais utilisés.
      </Text>

      {preference ? (
        <View style={[styles.preferenceBox, raised]}>
          <PreferenceRow
            label="Activer volontairement"
            value={preference.matchmakingEnabled}
            disabled={busy}
            onChange={(value) => updatePreference({ matchmakingEnabled: value })}
            textColor={colors.text}
          />
          <PreferenceRow
            label="Autoriser de nouvelles personnes"
            value={preference.allowNewPeople}
            disabled={busy}
            onChange={(value) => updatePreference({ allowNewPeople: value })}
            textColor={colors.text}
          />
        </View>
      ) : null}

      <Selector
        label="Objectif"
        values={PURPOSES}
        selected={[purpose]}
        busy={busy}
        colors={colors}
        onPress={(value) => setPurpose(value as (typeof PURPOSES)[number])}
      />
      <Selector
        label="Rythme"
        values={PACES}
        selected={[pace]}
        busy={busy}
        colors={colors}
        onPress={(value) => setPace(value as (typeof PACES)[number])}
      />
      <Selector
        label="Langues autorisées"
        values={LANGUAGES}
        selected={languages}
        busy={busy}
        colors={colors}
        onPress={(value) => toggleValue(value, languages, 5, setLanguages)}
      />
      <Selector
        label="Sujets choisis"
        values={TOPICS}
        selected={topics}
        busy={busy}
        colors={colors}
        onPress={(value) => toggleValue(value, topics, 8, setTopics)}
      />

      <Text style={[styles.label, { color: colors.text }]}>Créneau UTC</Text>
      <View style={styles.row}>
        <SmallInput value={dayOfWeek} onChange={setDayOfWeek} placeholder="Jour 0-6" colors={colors} />
        <SmallInput value={startMinute} onChange={setStartMinute} placeholder="Début" colors={colors} />
        <SmallInput value={endMinute} onChange={setEndMinute} placeholder="Fin" colors={colors} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Jour : 0 dimanche à 6 samedi. Minutes depuis minuit UTC.
      </Text>

      <View style={styles.row}>
        <ActionButton
          label="Rejoindre la file"
          disabled={busy || !canJoin}
          onPress={join}
          backgroundColor={colors.accent}
          textColor={colors.accentText}
        />
        <ActionButton
          label="Quitter"
          disabled={busy || !status?.queue}
          onPress={leave}
          borderColor={colors.secondary}
          textColor={colors.secondary}
        />
      </View>

      <Text style={{ color: colors.text, fontWeight: '800' }}>
        File : {status?.queue?.status ?? 'ABSENT'}
      </Text>

      {proposal ? (
        <View style={[styles.proposal, raised]}>
          <Text style={[styles.proposalTitle, { color: colors.text }]}>
            {proposal.partner?.displayName ?? 'Compte supprimé'}
          </Text>
          {proposal.partner ? (
            <Text style={{ color: colors.muted }}>@{proposal.partner.username}</Text>
          ) : null}
          <Text style={{ color: colors.accent, fontWeight: '900' }}>
            Explication : {proposal.score}/100
          </Text>
          {proposal.explanation.explanations.map((explanation) => (
            <Text key={explanation} style={{ color: colors.text }}>
              {explanation}
            </Text>
          ))}
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Sensible : non · affinité : non · messages privés : non · localisation précise : non
          </Text>
          {proposal.status === 'PENDING' && !proposal.yourDecision ? (
            <View style={styles.wrap}>
              <ActionButton
                label="Accepter"
                disabled={busy}
                onPress={() => decide('ACCEPT')}
                backgroundColor={colors.accent}
                textColor={colors.accentText}
              />
              <ActionButton
                label="Refuser"
                disabled={busy}
                onPress={() => decide('DECLINE')}
                borderColor={colors.secondary}
                textColor={colors.secondary}
              />
              <ActionButton
                label="Bloquer"
                disabled={busy}
                onPress={() => decide('BLOCK')}
                borderColor={colors.danger}
                textColor={colors.danger}
              />
            </View>
          ) : null}
          {proposal.yourDecision ? (
            <Text style={{ color: colors.secondary, fontWeight: '800' }}>
              Ta réponse : {proposal.yourDecision}
            </Text>
          ) : null}
          {proposal.status === 'ACCEPTED' ? (
            <Text style={{ color: colors.secondary, fontWeight: '900' }}>
              Acceptation mutuelle confirmée. Aucun lien n’est créé automatiquement.
            </Text>
          ) : null}
        </View>
      ) : null}

      {proposal?.status === 'ACCEPTED' && connection ? (
        <View style={[styles.connection, raised]}>
          <Text style={[styles.proposalTitle, { color: colors.text }]}>
            Choix privé post-acceptation
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Le détail du choix de l’autre personne reste privé. Seule votre intersection
            mutuelle peut créer une amitié ou une conversation.
          </Text>

          {connectionExecuted ? (
            <View style={{ gap: 8 }}>
              {connection.result.friendshipCreated ? (
                <Text style={{ color: colors.secondary, fontWeight: '900' }}>
                  Amitié créée par consentement mutuel.
                </Text>
              ) : null}
              {connection.result.conversationCreated ? (
                <Text style={{ color: colors.secondary, fontWeight: '900' }}>
                  Conversation créée par consentement mutuel.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <PreferenceRow
                label="Autoriser une amitié si le choix est mutuel"
                value={wantsFriendship}
                disabled={busy || !connection.available}
                onChange={setWantsFriendship}
                textColor={colors.text}
              />
              <PreferenceRow
                label="Autoriser une conversation si le choix est mutuel"
                value={wantsConversation}
                disabled={busy || !connection.available}
                onChange={setWantsConversation}
                textColor={colors.text}
              />
              <View style={styles.wrap}>
                <ActionButton
                  label="Enregistrer mes choix"
                  disabled={
                    busy ||
                    !connection.available ||
                    (!wantsFriendship && !wantsConversation)
                  }
                  onPress={saveConnectionIntent}
                  backgroundColor={colors.accent}
                  textColor={colors.accentText}
                />
                {connection.intent?.status === 'ACTIVE' ? (
                  <ActionButton
                    label="Révoquer"
                    disabled={busy}
                    onPress={revokeConnectionIntent}
                    borderColor={colors.secondary}
                    textColor={colors.secondary}
                  />
                ) : null}
              </View>
            </View>
          )}

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Réponse de l’autre personne : {connection.partnerResponded ? 'enregistrée' : 'pas encore enregistrée'}.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Expiration : {new Date(connection.expiresAt).toLocaleString()}.
          </Text>
          {!connection.available && !connectionExecuted ? (
            <Text style={{ color: colors.danger, fontWeight: '900' }}>
              Cette étape n’est plus disponible. Aucun lien n’a été créé automatiquement.
            </Text>
          ) : null}
        </View>
      ) : null}

      {message ? (
        <Text style={{ color: colors.secondary, fontWeight: '800' }}>{message}</Text>
      ) : null}
    </View>
  );
}

function Selector({
  label,
  values,
  selected,
  busy,
  colors,
  onPress
}: {
  label: string;
  values: readonly string[];
  selected: string[];
  busy: boolean;
  colors: {
    accent: string;
    accentText: string;
    surfaceRaised: string;
    border: string;
    text: string;
  };
  onPress: (value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.wrap}>
        {values.map((value) => (
          <Pressable
            key={value}
            disabled={busy}
            onPress={() => onPress(value)}
            style={[
              styles.choice,
              {
                backgroundColor: selected.includes(value)
                  ? colors.accent
                  : colors.surfaceRaised,
                borderColor: selected.includes(value)
                  ? colors.accent
                  : colors.border
              }
            ]}
          >
            <Text
              style={{
                color: selected.includes(value) ? colors.accentText : colors.text,
                fontWeight: '800'
              }}
            >
              {value.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SmallInput({
  value,
  onChange,
  placeholder,
  colors
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  colors: { text: string; muted: string; border: string };
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
    />
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
  backgroundColor,
  borderColor,
  textColor
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  backgroundColor?: string;
  borderColor?: string;
  textColor: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        backgroundColor ? { backgroundColor } : { borderWidth: 1, borderColor },
        disabled && styles.muted
      ]}
    >
      <Text style={{ color: textColor, fontWeight: '900' }}>{label}</Text>
    </Pressable>
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
  proposalTitle: { fontSize: 17, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  section: { gap: 8 },
  label: { fontSize: 14, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10
  },
  action: {
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
  choice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  proposal: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  connection: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  muted: { opacity: 0.5 }
});
