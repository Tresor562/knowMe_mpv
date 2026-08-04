import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type GameParticipant = {
  userId: string;
  position: number;
  status: string;
  user: { displayName: string; username: string } | null;
};

type GameSession = {
  id: string;
  game: { key: string; name: string; description: string };
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'CANCELLED' | 'EXPIRED';
  sequence: number;
  state: {
    round?: number;
    maxRounds?: number;
    scores?: number[];
    pendingPosition?: number | null;
  };
  currentTurnPosition: number | null;
  result?: Record<string, unknown> | null;
  viewerPosition: number;
  yourTurn: boolean;
  participants: GameParticipant[];
  replayed?: boolean;
};

type Replay = {
  actions: Array<{ sequence: number; actionType: string }>;
  checksum: string;
  verified: boolean;
  reproducible: boolean;
};

const TERMINAL = new Set(['COMPLETED', 'ABANDONED', 'CANCELLED', 'EXPIRED']);

function operationKey(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function GamePlatformExperience() {
  const { colors } = useAppearance();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [selected, setSelected] = useState<GameSession | null>(null);
  const [username, setUsername] = useState('');
  const [pulse, setPulse] = useState(5);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const viewer = useMemo(
    () => selected?.participants.find((item) => item.position === selected.viewerPosition),
    [selected]
  );

  async function refresh() {
    const next = await apiFetch<GameSession[]>('/games/sessions');
    setSessions(next);
    if (selected) {
      setSelected(await apiFetch<GameSession>(`/games/sessions/${selected.id}`));
    }
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Chargement des parties impossible.'));
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

  function create() {
    const opponent = username.trim().replace(/^@/, '');
    if (opponent.length < 3) return;
    void execute(async () => {
      const session = await apiFetch<GameSession>('/games/sessions', {
        method: 'POST',
        body: JSON.stringify({
          gameKey: 'pulse-duel',
          opponentUsernames: [opponent],
          idempotencyKey: operationKey('mobile-game-create')
        })
      });
      setSelected(session);
      setReplay(null);
      setUsername('');
      setMessage('Invitation créée. Le serveur conserve l’état officiel.');
    });
  }

  function open(id: string) {
    void execute(async () => {
      setSelected(await apiFetch<GameSession>(`/games/sessions/${id}`));
      setReplay(null);
    });
  }

  function join() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/join`, {
          method: 'POST'
        })
      );
    });
  }

  function reconnect() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/reconnect`, {
          method: 'POST'
        })
      );
    });
  }

  function play() {
    if (!selected?.yourTurn) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({
            actionType: 'PULSE',
            payload: { value: pulse },
            expectedSequence: selected.sequence,
            idempotencyKey: operationKey(`mobile-game-action-${selected.sequence + 1}`)
          })
        })
      );
    });
  }

  function abandon() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}/abandon`, {
          method: 'POST'
        })
      );
    });
  }

  function cancel() {
    if (!selected) return;
    void execute(async () => {
      setSelected(
        await apiFetch<GameSession>(`/games/sessions/${selected.id}`, {
          method: 'DELETE'
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
  const raised = { backgroundColor: colors.surfaceRaised, borderColor: colors.border };

  return (
    <View style={[styles.card, card]}>
      <Text style={[styles.title, { color: colors.text }]}>Jeux KnowMe</Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        Parties gratuites et autoritaires : le serveur valide les tours, calcule le score et signe le replay.
      </Text>

      <View style={styles.row}>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          maxLength={30}
          placeholder="Pseudo de l’adversaire"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
        />
        <Pressable
          disabled={busy || username.trim().length < 3}
          onPress={create}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.accent }, (pressed || busy) && styles.muted]}
        >
          <Text style={{ color: colors.accentText, fontWeight: '900' }}>Inviter</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Mes parties</Text>
      <View style={styles.wrap}>
        {sessions.map((session) => (
          <Pressable
            key={session.id}
            disabled={busy}
            onPress={() => open(session.id)}
            style={[styles.sessionPill, raised, selected?.id === session.id && { borderColor: colors.accent }]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>{session.game.name}</Text>
            <Text style={{ color: session.yourTurn ? colors.secondary : colors.muted, fontSize: 12 }}>
              {session.status}{session.yourTurn ? ' · À toi' : ''}
            </Text>
          </Pressable>
        ))}
        {!sessions.length ? <Text style={{ color: colors.muted }}>Aucune partie.</Text> : null}
      </View>

      {selected ? (
        <View style={[styles.detail, raised]}>
          <View style={styles.between}>
            <View>
              <Text style={[styles.detailTitle, { color: colors.text }]}>{selected.game.name}</Text>
              <Text style={{ color: colors.muted }}>{selected.status} · séquence {selected.sequence}</Text>
            </View>
            <Pressable disabled={busy} onPress={reconnect} style={[styles.smallButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Sync</Text>
            </Pressable>
          </View>

          <View style={styles.wrap}>
            {selected.participants.map((participant) => (
              <View key={participant.userId} style={[styles.player, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {participant.user?.displayName ?? 'Compte supprimé'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Position {participant.position + 1} · {participant.status}
                </Text>
              </View>
            ))}
          </View>

          {selected.status === 'WAITING' && viewer?.status === 'INVITED' ? (
            <Pressable disabled={busy} onPress={join} style={[styles.primaryButton, { backgroundColor: colors.accent }]}>
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>Rejoindre</Text>
            </Pressable>
          ) : null}

          {selected.status === 'ACTIVE' ? (
            <View style={styles.stack}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                Manche {selected.state.round}/{selected.state.maxRounds} · Scores {(selected.state.scores ?? []).join(' — ')}
              </Text>
              <Text style={{ color: selected.yourTurn ? colors.secondary : colors.muted }}>
                {selected.yourTurn ? 'À toi de jouer' : 'En attente de l’autre joueur'}
              </Text>
              {selected.yourTurn ? (
                <>
                  <View style={styles.wrap}>
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => (
                      <Pressable
                        key={value}
                        disabled={busy}
                        onPress={() => setPulse(value)}
                        style={[styles.value, { borderColor: pulse === value ? colors.accent : colors.border, backgroundColor: colors.surface }]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '900' }}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable disabled={busy} onPress={play} style={[styles.primaryButton, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: colors.accentText, fontWeight: '900' }}>Envoyer mon choix</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable disabled={busy} onPress={abandon} style={[styles.secondaryButton, { borderColor: colors.secondary }]}>
                <Text style={{ color: colors.secondary, fontWeight: '900' }}>Abandonner</Text>
              </Pressable>
            </View>
          ) : null}

          {selected.status === 'WAITING' && selected.viewerPosition === 0 ? (
            <Pressable disabled={busy} onPress={cancel} style={[styles.secondaryButton, { borderColor: colors.secondary }]}>
              <Text style={{ color: colors.secondary, fontWeight: '900' }}>Annuler l’invitation</Text>
            </Pressable>
          ) : null}

          {TERMINAL.has(selected.status) ? (
            <View style={styles.stack}>
              <Text style={{ color: colors.muted }}>{JSON.stringify(selected.result)}</Text>
              <Pressable disabled={busy} onPress={verifyReplay} style={[styles.primaryButton, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.accentText, fontWeight: '900' }}>Vérifier le replay</Text>
              </Pressable>
              {replay ? (
                <Text style={{ color: replay.verified ? colors.secondary : colors.danger, fontWeight: '800' }}>
                  {replay.verified ? 'Replay vérifié' : 'Replay invalide'} · {replay.actions.length} actions · {replay.checksum.slice(0, 12)}…
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {message ? <Text style={{ color: colors.secondary, fontWeight: '800' }}>{message}</Text> : null}
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Aucun score, gagnant, KnowCoin ou mise n’est envoyé par l’application.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { fontSize: 19, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13 },
  primaryButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, alignItems: 'center' },
  secondaryButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  smallButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sessionPill: { minWidth: 135, borderWidth: 1, borderRadius: 14, padding: 11 },
  detail: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  detailTitle: { fontSize: 17, fontWeight: '900' },
  player: { borderWidth: 1, borderRadius: 13, padding: 10 },
  value: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.5 }
});
