'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type SavedMessagesResponse = {
  items: Array<{ messageId: string }>;
};

export function SaveMessageControl({ messageId }: { messageId: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<SavedMessagesResponse>('/saved-messages?limit=100');
      setSaved(response.items.some((item) => item.messageId === messageId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'État indisponible.');
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (busy || loading) return;
    setBusy(true);
    setError('');
    try {
      if (saved) {
        await apiFetch(`/saved-messages/${encodeURIComponent(messageId)}`, {
          method: 'DELETE'
        });
        setSaved(false);
      } else {
        await apiFetch('/saved-messages', {
          method: 'POST',
          body: JSON.stringify({ messageId })
        });
        setSaved(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className={saved ? 'btn btn-accent' : 'btn'}
        aria-pressed={saved}
        disabled={busy || loading}
        onClick={() => void toggle()}
        style={{ padding: '5px 9px', minHeight: 34 }}
      >
        {loading ? '…' : saved ? '🔖 Enregistré' : '🔖 Enregistrer'}
      </button>
      {error && (
        <small role="alert" style={{ display: 'block', color: 'var(--orange)', marginTop: 5 }}>
          {error}
        </small>
      )}
    </div>
  );
}
