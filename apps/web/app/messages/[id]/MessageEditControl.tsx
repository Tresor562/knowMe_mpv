'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getRealtimeSocket } from '../../../lib/realtime';
import { useI18n } from '../../../components/i18n-provider';

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
  const { locale } = useI18n();
  const en = locale === 'en';
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
          setError(en?'This message changed on another device. Review the server version or cancel your changes.':'Ce message a été modifié ailleurs pendant ta saisie. Recharge ou annule tes changements locaux.');
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
  }, [baseContent, conversationId, en, messageId, onUpdated, socket]);

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
      onCancel?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : (en?'Unable to edit message.':'Modification impossible.');
      if (message.includes('MESSAGE_EDIT_VERSION_CONFLICT')) {
        setConflict(true);
        setError(en?'This message was already edited elsewhere. Reload the conversation before trying again.':'Ce message a déjà été modifié ailleurs. Recharge la conversation avant de réessayer.');
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
    <div className="km-message-edit-panel">
      <label htmlFor={`message-edit-${messageId}`}>
        {en?'Edit message':'Modifier ton message'}
      </label>
      <textarea
        id={`message-edit-${messageId}`}
        className="km-message-edit-textarea"
        value={content}
        maxLength={4000}
        rows={4}
        disabled={busy}
        onChange={(event) => setContent(event.target.value)}
        aria-label={en?'Edit message text':'Modifier le texte du message'}
      />
      <small className="km-message-edit-counter">{content.length}/4000</small>
      {error && <p role="alert" className="km-message-edit-error">{error}</p>}
      <div className="km-message-edit-actions">
        <button
          type="button"
          className="km-message-edit-save"
          disabled={busy || conflict || !content.trim()}
          onClick={() => void save()}
        >
          {busy ? (en?'Saving…':'Modification…') : (en?'Save':'Enregistrer')}
        </button>
        {conflict && (
          <button type="button" className="km-message-edit-secondary" disabled={busy} onClick={resetToServer}>
            {en?'Use server version':'Utiliser la version serveur'}
          </button>
        )}
        {onCancel && (
          <button type="button" className="km-message-edit-secondary" disabled={busy} onClick={onCancel}>
            {en?'Cancel':'Annuler'}
          </button>
        )}
      </div>
    </div>
  );
}
