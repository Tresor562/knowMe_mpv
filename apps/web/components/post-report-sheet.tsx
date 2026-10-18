'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';
import './post-report-sheet.css';

type Reason = 'SPAM' | 'HARASSMENT' | 'SCAM' | 'INAPPROPRIATE' | 'OTHER';

const REASONS: Array<{ code: Reason; fr: string; en: string }> = [
  { code: 'SPAM', fr: 'Spam ou publicité abusive', en: 'Spam or unwanted advertising' },
  { code: 'HARASSMENT', fr: 'Harcèlement ou intimidation', en: 'Harassment or bullying' },
  { code: 'SCAM', fr: 'Arnaque ou tromperie', en: 'Scam or misleading content' },
  { code: 'INAPPROPRIATE', fr: 'Contenu inapproprié', en: 'Inappropriate content' },
  { code: 'OTHER', fr: 'Autre raison', en: 'Other reason' }
];

/** Reports are created by the authenticated API; hiding a post is a separate action. */
export function PostReportSheet({ post, en, onBack, onComplete }: {
  post: { id: string; content: string; author: { displayName: string } };
  en: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [reason, setReason] = useState<Reason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inflight = useRef(false);
  const initialFocus = useRef<HTMLElement | null>(null);
  const firstChoice = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const completeButton = useRef<HTMLButtonElement>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    initialFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstChoice.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!inflight.current) onBackRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      initialFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (submitted) completeButton.current?.focus();
  }, [submitted]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || submitted || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError('');
    const selected = REASONS.find(item => item.code === reason);
    const label = selected?.fr ?? '';
    // Keep the moderation vocabulary stable across translated clients.
    const description = [label, details.trim()].filter(Boolean).join(' : ').slice(0, 500);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'POST',
          targetId: post.id,
          reason: description
        })
      });
      setSubmitted(true);
    } catch (cause) {
      const failure = cause as { code?: string; message?: string };
      const uncertain = failure?.code === 'KNOWME_TIMEOUT' ||
        failure?.code === 'KNOWME_NETWORK_UNAVAILABLE';
      setError(uncertain
        ? (en
          ? 'Submission not confirmed. Check your reports before trying again.'
          : 'Envoi non confirmé. Vérifie tes signalements avant de réessayer.')
        : cause instanceof Error ? cause.message :
          (en ? 'Unable to send report.' : 'Signalement impossible.'));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="km-comment-report-overlay" role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !inflight.current) {
          if (submitted) onComplete();
          else onBack();
        }
      }}>
      <form ref={dialogRef} tabIndex={-1} className="km-comment-report-sheet" role="dialog" aria-modal="true"
        aria-label={en ? 'Report publication' : 'Signaler la publication'}
        onSubmit={event => void submit(event)}>
        <div className="km-comment-report-handle" aria-hidden="true" />
        <header>
          <h2>{en ? 'Report publication' : 'Signaler la publication'}</h2>
          <button type="button" disabled={busy}
            aria-label={en ? 'Close report' : 'Fermer le signalement'}
            onClick={submitted ? onComplete : onBack}>×</button>
        </header>
        {submitted ? (
          <>
            <p role="status">
              {en
                ? 'The publication has been sent to KnowMe moderation.'
                : 'La publication a été transmise à la modération KnowMe.'}
            </p>
            <Link className="km-post-report-history-link" href="/feed/reports">
              {en ? 'View my reports' : 'Consulter mes signalements'}
            </Link>
            <button ref={completeButton} className="km-comment-report-submit" type="button" onClick={onComplete}>
              {en ? 'Done' : 'Terminer'}
            </button>
          </>
        ) : (
          <>
            <p className="km-comment-report-author">
              {en ? 'Publication by ' : 'Publication de '}{post.author.displayName}
            </p>
            <p className="km-comment-report-preview">
              {post.content || (en ? 'Publication with media' : 'Publication avec média')}
            </p>
            <fieldset disabled={busy}>
              <legend>{en
                ? 'Why are you reporting this publication?'
                : 'Pourquoi souhaites-tu signaler cette publication ?'}</legend>
              {REASONS.map((item, index) => (
                <label className="km-comment-report-choice" key={item.code}>
                  <input ref={index === 0 ? firstChoice : undefined}
                    type="radio" name="reason" required
                    checked={reason === item.code} onChange={() => setReason(item.code)} />
                  <span>{en ? item.en : item.fr}</span>
                </label>
              ))}
            </fieldset>
            <label className="km-comment-report-details">
              {en ? 'Details (optional)' : 'Précisions (facultatif)'}
              <textarea value={details} disabled={busy} rows={2} maxLength={350}
                onChange={event => setDetails(event.target.value)}
                placeholder={en ? 'Briefly describe the problem' : 'Décris brièvement le problème'} />
            </label>
            {error && <p role="alert" className="km-comment-report-error">{error}</p>}
            <button className="km-comment-report-submit" type="submit" disabled={!reason || busy}>
              {busy ? (en ? 'Sending…' : 'Envoi…') :
                (en ? 'Submit report' : 'Envoyer le signalement')}
            </button>
            <Link className="km-post-report-history-link" href="/feed/reports">
              {en ? 'Review my past reports' : 'Vérifier mes signalements précédents'}
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
