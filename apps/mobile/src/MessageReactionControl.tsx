import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { getRealtimeSocket } from './realtime';

const STANDARD_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉'] as const;

type ReactionSnapshot = {
  conversationId: string;
  messageId: string;
  myReaction: string | null;
  reactions: Array<{ emoji: string; count: number }>;
  removed?: boolean;
};

type ReactionEvent = {
  conversationId: string;
  messageId: string;
  reactions: Array<{ emoji: string; count: number }>;
};

export function MessageReactionControl({ messageId }: { messageId: string }) {
  const { colors } = useAppearance();
  const [snapshot, setSnapshot] = useState<ReactionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setSnapshot(await apiFetch<ReactionSnapshot>(`/message-reactions/${encodeURIComponent(messageId)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Réactions indisponibles.');
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let connectedSocket: Awaited<ReturnType<typeof getRealtimeSocket>> = null;
    const onReactions = (event: ReactionEvent) => {
      if (event.messageId !== messageId) return;
      setSnapshot((current) =>
        current
          ? { ...current, conversationId: event.conversationId, reactions: event.reactions }
          : current
      );
    };

    void getRealtimeSocket().then((socket) => {
      if (!active || !socket) return;
      connectedSocket = socket;
      socket.on('message:reactions', onReactions);
    });

    return () => {
      active = false;
      connectedSocket?.off('message:reactions', onReactions);
    };
  }, [messageId]);

  const counts = useMemo(
    () => new Map(snapshot?.reactions.map((item) => [item.emoji, item.count]) ?? []),
    [snapshot]
  );

  async function choose(emoji: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = snapshot?.myReaction === emoji
        ? await apiFetch<ReactionSnapshot>(`/message-reactions/${encodeURIComponent(messageId)}`, {
            method: 'DELETE'
          })
        : await apiFetch<ReactionSnapshot>(`/message-reactions/${encodeURIComponent(messageId)}`, {
            method: 'PUT',
            body: JSON.stringify({ emoji })
          });
      setSnapshot(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Réaction impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="Réactions au message"
      >
        {STANDARD_REACTIONS.map((emoji) => {
          const selected = snapshot?.myReaction === emoji;
          const count = counts.get(emoji) ?? 0;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: busy }}
              disabled={busy}
              onPress={() => void choose(emoji)}
              style={[
                styles.button,
                { borderColor: selected ? colors.accent : colors.border },
                selected && { backgroundColor: colors.surfaceRaised },
                busy && styles.disabled
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {emoji}{count ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  row: { gap: 6, paddingRight: 10 },
  button: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  disabled: { opacity: 0.5 },
  error: { fontSize: 12, lineHeight: 17 }
});
