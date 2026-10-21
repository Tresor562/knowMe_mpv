'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';
import { KnowMeIconButton } from './knowme-icon-button';

type ReportReason = 'SPAM' | 'HARASSMENT' | 'SCAM' | 'INAPPROPRIATE' | 'OTHER';

const REASONS: Array<{ code: ReportReason; label: string }> = [
  { code:'SPAM', label:'Spam ou publicité abusive' },
  { code:'HARASSMENT', label:'Harcèlement ou intimidation' },
  { code:'SCAM', label:'Arnaque ou tromperie' },
  { code:'INAPPROPRIATE', label:'Contenu inapproprié' },
  { code:'OTHER', label:'Autre raison' }
];

export function CommentReportSheet({ comment, onClose, onReported }: {
  comment: { id: string; content: string; author: { displayName: string } };
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inflight = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !inflight.current) onClose();
    };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError('');
    const choice = REASONS.find(entry => entry.code === reason)?.label ?? '';
    const message = [choice, details.trim()].filter(Boolean).join(' : ').slice(0, 500);
    try {
      await apiFetch('/reports', {
        method:'POST',
        body:JSON.stringify({ targetType:'COMMENT', targetId:comment.id, reason:message })
      });
      onReported();
      onClose();
    } catch (cause) {
      const failure = cause as { code?: string; message?: string };
      setError(
        failure?.code === 'KNOWME_TIMEOUT' || failure?.code === 'KNOWME_NETWORK_UNAVAILABLE'
          ? 'Signalement non confirmé. Vérifie tes signalements avant de réessayer.'
          : cause instanceof Error ? cause.message : 'Signalement impossible.'
      );
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="km-comment-report-overlay" role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}>
      <form className="km-comment-report-sheet" role="dialog" aria-modal="true"
        aria-label="Signaler le commentaire" onSubmit={event => void submit(event)}>
        <div className="km-comment-report-handle" aria-hidden="true"/>
        <header>
          <h2>Signaler le commentaire</h2>
          <KnowMeIconButton name="close" size={20} disabled={busy}
            onClick={onClose} label="Fermer le signalement"/>
        </header>
        <p className="km-comment-report-author">Commentaire de {comment.author.displayName}</p>
        <p className="km-comment-report-preview">{comment.content}</p>
        <fieldset>
          <legend>Pourquoi souhaites-tu signaler ce commentaire ?</legend>
          {REASONS.map(item => (
            <label className="km-comment-report-choice" key={item.code}>
              <input type="radio" name="reason" checked={reason === item.code}
                onChange={() => setReason(item.code)} required />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="km-comment-report-details">
          Précisions (facultatif)
          <textarea value={details} onChange={event => setDetails(event.target.value)}
            maxLength={350} rows={2} placeholder="Décris brièvement le problème"/>
        </label>
        {error && <p role="alert" className="km-comment-report-error">{error}</p>}
        <button className="km-comment-report-submit" type="submit" disabled={busy || !reason}>
          <KnowMeAnimatedIcon name="send" state={busy ? 'sending' : 'idle'} size={19} />
          {busy ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </form>
    </div>
  );
}
