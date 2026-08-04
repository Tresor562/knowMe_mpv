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

const PURPOSES = ['CHAT', 'PLAY', 'LEARN', 'CREATE'] as const;
const PACES = ['REALTIME', 'ASYNC', 'FLEXIBLE'] as const;
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
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>('LEARN');
  const [pace, setPace] = useState<(typeof PACES)[number]>('FLEXIBLE');
  const [languages, setLanguages] = useState('fr,en');
  const [topics, setTopics] = useState<string[]>(['TECH', 'BOOKS']);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startMinute, setStartMinute] = useState('900');
  const [endMinute, setEndMinute] = useState('1020');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [nextPreference, nextStatus] = await Promise.all([
      apiFetch<Preference>('/social-matchmaking/preferences'),
      apiFetch<MatchStatus>('/social-matchmaking/status')
    ]);
    setPreference(nextPreference);
    setStatus(nextStatus);
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

  function toggleTopic(topic: string) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : current.length < 8
          ? [...current, topic]
          : current
    );
  }

  function join() {
    const day = Number(dayOfWeek);
    const start = Number(startMinute);
    const end = Number(endMinute);
    if (!Number.isInteger(day) || !Number.isInteger(start) || !Number.isInteger(end)) return;
    void execute(async () => {
      setStatus(
        await apiFetch<MatchStatus>('/social-matchmaking/queue', {
          method: 'POST',
          body: JSON.stringify({
            purpose,
            pace,
            languages: [
              ...new Set(
                languages
                  .split(',')
                  .map((language) => language.trim().toLowerCase())
                  .filter(Boolean)
              )
            ],
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
    if (!status?.proposal) return;
    void execute(async () => {
      setStatus(
        await apiFetch<MatchStatus>(
          `/social-matchmaking/proposals/${status.proposal.id}/decision`,
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

  const card = { backgroundColor: colors.surface, borderColor: colors.border };
  const raised = {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border
  };
  const canJoin =
    preference?.matchmakingEnabled &&
    preference.allowNewPeople &&
    topics.length > 0 &&
    languages.trim().length > 0 &&
    Number(endMinute) - Number(startMinute) >= 30;

  return (
    <View style={[styles.card, card]}>
      <Text style={[styles.title, { color: colors.text }]}>Rencontres sociales</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Appariement volontaire fondé uniquement sur les critères que tu choisis ici. Les
        réponses d’affinité, messages privés, données sensibles et localisation précise ne
        sont jamais utilisés.
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

      <Text style={[styles.label, { color: colors.text }]}>Objectif</Text>
      <View style={styles.wrap}>
        {PURPOSES.map((value) => (
          <ChoiceButton
            key={value}
            label={value}
            active={purpose === value}
            disabled={busy}
            onPress={() => setPurpose(value)}
            colors={colors}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Rythme</Text>
      <View style={styles.wrap}>
        {PACES.map((value) => (
          <ChoiceButton
            key={value}
            label={value}
            active={pace === value}
            disabled={busy}
            onPress={() => setPace(value)}
            colors={colors}
          />
        ))}
      </View>

      <TextInput
        value={languages}
        onChangeText={setLanguages}
        autoCapitalize="none"
        maxLength={60}
        placeholder="Langues : fr,en"
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

      <Text style={[styles.label, { color: colors.text }]}>Sujets choisis</Text>
      <View style={styles.wrap}>
        {TOPICS.map((topic) => (
          <ChoiceButton
            key={topic}
            label={topic.replace('_', ' ')}
            active={topics.includes(topic)}
            disabled={busy}
            onPress={() => toggleTopic(topic)}
            colors={colors}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Créneau UTC</Text>
      <View style={styles.row}>
        <TextInput
          value={dayOfWeek}
          onChangeText={setDayOfWeek}
          keyboardType="number-pad"
          placeholder="Jour 0-6"
          placeholderTextColor={colors.muted}
          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={startMinute}
          onChangeText={setStartMinute}
          keyboardType="number-pad"
          placeholder="Début"
          placeholderTextColor={colors.muted}
          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={endMinute}
          onChangeText={setEndMinute}
          keyboardType="number-pad"
          placeholder="Fin"
          placeholderTextColor={colors.muted}
          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
        />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Jour : 0 dimanche à 6 samedi. Minutes depuis minuit UTC.
      </Text>

      <View style={styles.row}>
        <Pressable
          disabled={busy || !canJoin}
          onPress={join}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.accent },
            (!canJoin || busy) && styles.muted
          ]}
        >
          <Text style={{ color: colors.accentText, fontWeight: '900' }}>
            Rejoindre la file
          </Text>
        </Pressable>
        <Pressable
          disabled={busy || !status?.queue}
          onPress={leave}
          style={[styles.secondaryButton, { borderColor: colors.secondary }]}
        >
          <Text style={{ color: colors.secondary, fontWeight: '900' }}>
            Quitter
          </Text>
        </Pressable>
      </View>

      <Text style={{ color: colors.text, fontWeight: '800' }}>
        File : {status?.queue?.status ?? 'ABSENT'}
      </Text>

      {status?.proposal ? (
        <View style={[styles.proposal, raised]}>
          <Text style={[styles.proposalTitle, { color: colors.text }]}>
            {status.proposal.partner?.displayName ?? 'Compte supprimé'}
          </Text>
          {status.proposal.partner ? (
            <Text style={{ color: colors.muted }}>
              @{status.proposal.partner.username}
            </Text>
          ) : null}
          <Text style={{ color: colors.accent, fontWeight: '900' }}>
            Explication : {status.proposal.score}/100
          </Text>
          {status.proposal.explanation.explanations.map((explanation) => (
            <Text key={explanation} style={{ color: colors.text }}>
              {explanation}
            </Text>
          ))}
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Sensible : non · affinité : non · messages privés : non · localisation précise : non
          </Text>
          {status.proposal.status === 'PENDING' && !status.proposal.yourDecision ? (
            <View style={styles.wrap}>
              <Pressable
                disabled={busy}
                onPress={() => decide('ACCEPT')}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: colors.accentText, fontWeight: '900' }}>
                  Accepter
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => decide('DECLINE')}
                style={[styles.secondaryButton, { borderColor: colors.secondary }]}
              >
                <Text style={{ color: colors.secondary, fontWeight: '900' }}>
                  Refuser
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => decide('BLOCK')}
                style={[styles.secondaryButton, { borderColor: colors.danger }]}
              >
                <Text style={{ color: colors.danger, fontWeight: '900' }}>
                  Bloquer
                </Text>
              </Pressable>
            </View>
          ) : null}
          {status.proposal.yourDecision ? (
            <Text style={{ color: colors.secondary, fontWeight: '800' }}>
              Ta réponse : {status.proposal.yourDecision}
            </Text>
          ) : null}
          {status.proposal.status === 'ACCEPTED' ? (
            <Text style={{ color: colors.secondary, fontWeight: '900' }}>
              Acceptation mutuelle confirmée.
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

function ChoiceButton({
  label,
  active,
  disabled,
  onPress,
  colors
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: {
    accent: string;
    accentText: string;
    surfaceRaised: string;
    border: string;
    text: string;
  };
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: active ? colors.accent : colors.surfaceRaised,
          borderColor: active ? colors.accent : colors.border
        }
      ]}
    >
      <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '900' },
  proposalTitle: { fontSize: 17, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13
  },
  smallInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10
  },
  primaryButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center'
  },
  preferenceBox: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  choice: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  proposal: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  muted: { opacity: 0.5 }
});
