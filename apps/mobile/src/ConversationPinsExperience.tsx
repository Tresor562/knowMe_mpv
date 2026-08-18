import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Pin = {
  userId: string;
  conversationId: string;
  pinnedAt: string;
  position: number;
};

type PinList = {
  items: Pin[];
  limit: number;
  remaining: number;
  canPinMore: boolean;
};

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export function ConversationPinsExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [pins, setPins] = useState<Pin[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [canPinMore, setCanPinMore] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [authorityValid, setAuthorityValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const clearAuthority = useCallback(() => {
    setPins([]);
    setConversations([]);
    setLimit(null);
    setRemaining(null);
    setCanPinMore(null);
    setAuthorityValid(false);
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    clearAuthority();
    try {
      const [pinData, conversationData] = await Promise.all([
        apiFetch<PinList>('/conversation-pins'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setPins(pinData.items);
      setLimit(pinData.limit);
      setRemaining(pinData.remaining);
      setCanPinMore(pinData.canPinMore);
      setConversations(conversationData);
      setAuthorityValid(true);
    } catch (cause) {
      clearAuthority();
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [clearAuthority]);

  useEffect(() => {
    void load();
  }, [load]);

  const names = useMemo(() => {
    return new Map(
      conversations.map((conversation) => {
        const peers = conversation.members.filter((member) => member.userId !== currentUserId);
        const label = conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
        return [conversation.id, label] as const;
      })
    );
  }, [conversations, currentUserId]);

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.conversationId)), [pins]);
  const capacityKnown = authorityValid && limit !== null && remaining !== null && canPinMore !== null;
  const mutationBusy = busyId !== null || ordering;

  function invalidateAuthority(message: string) {
    clearAuthority();
    setError(message);
  }

  async function pin(conversationId: string) {
    if (!authorityValid || mutationBusy) return;
    if (!capacityKnown || !canPinMore) {
      setError(
        capacityKnown
          ? `La limite de ${limit} conversations épinglées est atteinte.`
          : 'Capacité d’épinglage indisponible.'
      );
      return;
    }

    setBusyId(conversationId);
    setError('');
    try {
      await apiFetch(`/conversation-pins/${encodeURIComponent(conversationId)}`, { method: 'PUT' });
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Épinglage impossible. Recharge les conversations avant de réessayer.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function unpin(conversationId: string) {
    if (!authorityValid || mutationBusy) return;

    setBusyId(conversationId);
    setError('');
    try {
      await apiFetch(`/conversation-pins/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Désépinglage impossible. Recharge les conversations avant de réessayer.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function movePin(index: number, direction: -1 | 1) {
    if (!authorityValid || mutationBusy) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pins.length) return;

    const currentPin = pins[index];
    const targetPin = pins[targetIndex];
    if (!currentPin || !targetPin) return;

    const expectedConversationIds = pins.map((pinItem) => pinItem.conversationId);
    const next = [...pins];
    next[index] = targetPin;
    next[targetIndex] = currentPin;
    setOrdering(true);
    setError('');
    try {
      await apiFetch('/conversation-pins/order', {
        method: 'PUT',
        body: JSON.stringify({
          conversationIds: next.map((pinItem) => pinItem.conversationId),
          expectedConversationIds
        })
      });
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Réorganisation impossible. Recharge les conversations avant de réessayer.'
      );
    } finally {
      setOrdering(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>MESSAGERIE · ORGANISATION PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Conversations épinglées</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>
        Les épingles et leur ordre sont personnels et ne changent jamais les membres, rôles ou permissions.
      </Text>
      {authorityValid ? (
        <Text style={[styles.muted, { color: colors.muted }]}>
          {!capacityKnown
            ? 'Capacité d’épinglage indisponible.'
            : `${pins.length}/${limit} épingle(s) utilisée(s) · ${remaining} restante(s).`}
        </Text>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}
      {!loading && !authorityValid ? (
        <Pressable
          disabled={mutationBusy}
          onPress={() => void load()}
          style={[styles.secondary, { borderColor: colors.border, alignSelf: 'flex-start' }, mutationBusy && styles.disabled]}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Recharger</Text>
        </Pressable>
      ) : null}

      {authorityValid ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Épinglées</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>Utilise les flèches pour définir l’ordre affiché. Le serveur reste l’autorité de l’ordre enregistré.</Text>
          {pins.map((pinItem, index) => (
            <View key={pinItem.conversationId} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {names.get(pinItem.conversationId) ?? 'Conversation'}
                </Text>
                <Text style={[styles.small, { color: colors.muted }]}>Position {index + 1} · épinglée le {new Date(pinItem.pinnedAt).toLocaleString()}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel={`Monter ${names.get(pinItem.conversationId) ?? 'la conversation'}`}
                  disabled={mutationBusy || index === 0}
                  onPress={() => void movePin(index, -1)}
                  style={[styles.secondary, { borderColor: colors.border }, (mutationBusy || index === 0) && styles.disabled]}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>↑</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Descendre ${names.get(pinItem.conversationId) ?? 'la conversation'}`}
                  disabled={mutationBusy || index === pins.length - 1}
                  onPress={() => void movePin(index, 1)}
                  style={[styles.secondary, { borderColor: colors.border }, (mutationBusy || index === pins.length - 1) && styles.disabled]}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>↓</Text>
                </Pressable>
                {onOpenConversation ? (
                  <Pressable
                    disabled={mutationBusy}
                    onPress={() => onOpenConversation(pinItem.conversationId)}
                    style={[styles.secondary, { borderColor: colors.border }, mutationBusy && styles.disabled]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800' }}>Ouvrir</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={mutationBusy}
                  onPress={() => void unpin(pinItem.conversationId)}
                  style={[styles.secondary, { borderColor: colors.border }, mutationBusy && styles.disabled]}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {busyId === pinItem.conversationId ? 'Retrait…' : 'Désépingler'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!pins.length ? <Text style={[styles.muted, { color: colors.muted }]}>Aucune conversation épinglée.</Text> : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Autres conversations</Text>
          {capacityKnown && !canPinMore ? (
            <Text style={[styles.muted, { color: colors.muted }]}>La limite de {limit} est atteinte. Désépingle une conversation avant d'en ajouter une autre.</Text>
          ) : null}
          {conversations.filter((conversation) => !pinnedIds.has(conversation.id)).map((conversation) => (
            <View key={conversation.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                disabled={!onOpenConversation || mutationBusy}
                onPress={() => onOpenConversation?.(conversation.id)}
                style={[styles.cardCopy, mutationBusy && styles.disabled]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{names.get(conversation.id)}</Text>
              </Pressable>
              <Pressable
                disabled={mutationBusy || !capacityKnown || !canPinMore}
                onPress={() => void pin(conversation.id)}
                style={[
                  styles.primary,
                  { backgroundColor: colors.accent },
                  (mutationBusy || !capacityKnown || !canPinMore) && styles.disabled
                ]}
              >
                <Text style={{ color: colors.accentText, fontWeight: '900' }}>
                  {busyId === conversation.id ? 'Épinglage…' : 'Épingler'}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 19, fontWeight: '900', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  small: { fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  secondary: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  disabled: { opacity: 0.45 }
});
