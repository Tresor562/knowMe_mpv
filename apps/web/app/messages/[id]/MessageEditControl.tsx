'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getRealtimeSocket } from '../../../lib/realtime';

type EditedMessage = {
  id: string;
  conversationId: string;
  content: string;
  editedAt: string | null;
  presentation?: { kind: 'TEXT'; text: string };
};

export function MessageEditControl({
  conversationId,
  messageId,
  initialContent,
  initialEditedAt,
  onUpdated,
  onCancel
}: {
  conversationId: string;
  messageId: string;
  initialContent: string;
  initialEditedAt: string | null;
  onUpdated?: (message: EditedMessage) => void;
  onCancel?: () => void;
}) {
  const socket = useMemo(() => getRealtimeSocket(), []);
  const [content, setContent] = useState(initialContent);
  const [baseContent, setBaseContent] = useState(initialContent);
  const [editedAt, setEditedAt] = useState<string | null>(initialEditedAt);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onMessageUpdated = (message: EditedMessage) => {
      if (message.id !== messageId || message.conversationId !== conversationId) return;
      setEditedAt(message.editedAt);
      setBaseContent(message.content);
      setContent((current) => {
        if (current !== baseContent && current !== message.content) {
          setConflict(true);
          setError('Ce message a été modifié ailleurs pendant ta saisie. Recharge ou annule tes changements locaux.');
          return current;
        }
        setConflict(false);
        setError('');
        return message.content;
      });
      onUpdated?.(message);
    };
    socket.on('message:updated', onMessageUpdated);
    return () => {
      socket.off('message:updated', onMessageUpdated);
    };
  }, [baseContent, conversationId, messageId, onUpdated, socket]);

  async function save() {
    const normalized = content.trim();
    if (!normalized || normalized.length > 4000 || busy || conflict) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiFetch<EditedMessage>(
        `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            content: normalized,
            expectedEditedAt: editedAt
          })
        }
      );
      setContent(updated.content);
      setBaseContent(updated.content);
      setEditedAt(updated.editedAt);
      setConflict(false);
      onUpdated?.(updated);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Modification impossible.';
      if (message.includes('MESSAGE_EDIT_VERSION_CONFLICT')) {
        setConflict(true);
        setError('Ce message a déjà été modifié ailleurs. Recharge la conversation avant de réessayer.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  function resetToServer() {
    setContent(baseContent);
    setConflict(false);
    setError('');
  }

  return (
    <div className="card" style={{ padding: 12, marginTop: 8 }}>
      <label htmlFor={`message-edit-${messageId}`} style={{ display: 'block', fontWeight: 800, marginBottom: 8 }}>
        Modifier ton message
      </label>
      <textarea
        id={`message-edit-${messageId}`}
        className="input"
        value={content}
        maxLength={4000}
        rows={4}
        disabled={busy}
        onChange={(event) => setContent(event.target.value)}
        style={{ width: '100%', resize: 'vertical' }}
      />
      <small style={{ color: 'var(--muted)' }}>{content.length}/4000</small>
      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || conflict || !content.trim()}
          onClick={() => void save()}
        >
          {busy ? 'Modification…' : 'Enregistrer'}
        </button>
        {conflict && (
          <button type="button" className="btn" disabled={busy} onClick={resetToServer}>
            Utiliser la version serveur
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn" disabled={busy} onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
