'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getRealtimeSocket } from '../../../lib/realtime';

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
  const socket = useMemo(() => getRealtimeSocket(), []);
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
    const onReactions = (event: ReactionEvent) => {
      if (event.messageId !== messageId) return;
      setSnapshot((current) =>
        current
          ? { ...current, conversationId: event.conversationId, reactions: event.reactions }
          : current
      );
    };
    socket.on('message:reactions', onReactions);
    return () => {
      socket.off('message:reactions', onReactions);
    };
  }, [messageId, socket]);

  async function choose(emoji: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = snapshot?.myReaction === emoji
        ? await apiFetch<ReactionSnapshot>(`/message-reactions/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
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

  const counts = new Map(snapshot?.reactions.map((item) => [item.emoji, item.count]) ?? []);

  return (
    <div style={{ marginTop: 8 }}>
      <div aria-label="Réactions au message" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STANDARD_REACTIONS.map((emoji) => {
          const selected = snapshot?.myReaction === emoji;
          const count = counts.get(emoji) ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              className={selected ? 'btn btn-accent' : 'btn'}
              aria-pressed={selected}
              disabled={busy}
              onClick={() => void choose(emoji)}
              style={{ padding: '5px 9px', minHeight: 34 }}
            >
              <span aria-hidden="true">{emoji}</span>{count ? ` ${count}` : ''}
            </button>
          );
        })}
      </div>
      {error && <small role="alert" style={{ display: 'block', color: 'var(--orange)', marginTop: 6 }}>{error}</small>}
    </div>
  );
}
