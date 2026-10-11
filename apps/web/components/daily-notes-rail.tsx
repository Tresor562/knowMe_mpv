'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';
import { apiFetch } from '../lib/api';

type DailyNote = {
  id: string;
  userId: string;
  content: string;
  expiresAt: string;
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
};

export function DailyNotesRail({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const own = notes.find(note => note.userId === userId);

  async function load() {
    const result = await apiFetch<DailyNote[]>('/daily-notes');
    setNotes(result.filter(note => new Date(note.expiresAt).getTime() > Date.now()));
  }

  useEffect(() => {
    let alive = true;
    apiFetch<DailyNote[]>('/daily-notes')
      .then(result => { if (alive) setNotes(result.filter(note => new Date(note.expiresAt).getTime() > Date.now())); })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'Notes indisponibles.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  async function publish() {
    const value = content.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/daily-notes', { method: 'POST', body: JSON.stringify({ content: value }) });
      await load();
      setEditorOpen(false);
      setContent('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not publish your note.' : 'Impossible de publier ta pensée.'));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/daily-notes/me', { method: 'DELETE' });
      await load();
      setEditorOpen(false);
      setContent('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not delete the note.' : 'Impossible de supprimer la pensée.'));
    } finally { setBusy(false); }
  }

  return <section className="km-daily-notes" aria-label={en ? 'Daily thoughts from friends' : 'Pensées du jour des amis'}>
    <div className="km-notes-heading">
      <strong>{en ? 'Daily thoughts' : 'Pensées du jour'}</strong>
      <small>{en ? 'Visible to friends for 24 hours' : 'Visibles aux amis pendant 24 h'}</small>
    </div>
    <div className="km-notes-rail">
      <button type="button" className="km-note-item" onClick={() => {
        setContent(own?.content ?? '');
        setEditorOpen(true);
      }} aria-label={own ? (en ? 'Edit my thought' : 'Modifier ma pensée') : (en ? 'Add my thought' : 'Ajouter ma pensée')}>
        <div className="km-note-bubble">{own ? own.content : '+'}</div>
        <div className="km-note-avatar km-note-own">+</div>
        <span>{en ? 'Your thought' : 'Ma pensée'}</span>
      </button>
      {!loading && notes.filter(note => note.userId !== userId).map(note =>
        <div className="km-note-item" key={note.id} title={note.content}>
          <div className="km-note-bubble">{note.content}</div>
          <div className="km-note-avatar">
            {note.user.avatarUrl
              ? <img src={note.user.avatarUrl} alt="" />
              : <span>{Array.from(note.user.displayName)[0] ?? '?'}</span>}
          </div>
          <span title={note.user.displayName}>{note.user.displayName}</span>
        </div>
      )}
    </div>
    {error && <p className="km-auth-error" role="alert">{error}</p>}
    {editorOpen && <div className="km-note-overlay" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target && !busy) setEditorOpen(false);
    }}>
      <section className="km-note-composer" role="dialog" aria-modal="true"
        aria-labelledby="km-note-dialog-title">
        <header>
          <strong id="km-note-dialog-title">{en ? 'Your daily thought' : 'Ta pensée du jour'}</strong>
          <button type="button" aria-label={en ? 'Close' : 'Fermer'} disabled={busy}
            onClick={() => setEditorOpen(false)}>×</button>
        </header>
        <p>{en ? 'This short thought is shown only to your friends for 24 hours.'
          : 'Cette note courte est visible uniquement par tes amis pendant 24 heures.'}</p>
        <textarea autoFocus maxLength={100} rows={3}
          value={content} onChange={event => setContent(event.target.value)}
          placeholder={en ? 'What is on your mind?' : 'À quoi penses-tu ?'}
          aria-label={en ? 'Daily thought' : 'Pensée du jour'}/>
        <small>{content.length}/100</small>
        <footer>
          {own && <button type="button" disabled={busy} onClick={() => void remove()}>
            {en ? 'Delete' : 'Supprimer'}
          </button>}
          <button type="button" className="btn btn-primary"
            disabled={!content.trim() || busy} onClick={() => void publish()}>
            {busy ? (en ? 'Saving…' : 'Enregistrement…') : (en ? 'Publish' : 'Publier')}
          </button>
        </footer>
      </section>
    </div>}
  </section>;
}
