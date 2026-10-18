'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';
import { apiFetch, getAccessToken } from '../lib/api';
import {
  applyCreatorFollowMutation, creatorFollowAction,
  type CreatorFollowMutation, type CreatorFollowSnapshot
} from '../lib/creator-follow-state';

/**
 * Isolated control to integrate with the canonical creator page after PR #583
 * has been reconciled. No hidden writes: follow/unfollow is explicit only.
 */
export function CreatorFollowControl({
  slug, initialFollowerCount
}: {
  slug: string;
  initialFollowerCount: number;
}) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [signedIn, setSignedIn] = useState(false);
  const [snapshot, setSnapshot] = useState<CreatorFollowSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const result = await apiFetch<CreatorFollowSnapshot>(
      `/creators/${encodeURIComponent(slug)}/follow-status`
    );
    setSnapshot(result);
    return result;
  }, [slug]);

  useEffect(() => {
    let active = true;
    const authenticated = Boolean(getAccessToken());
    setSignedIn(authenticated);
    setSnapshot(null);
    setNotice('');
    setLoading(authenticated);
    if (authenticated) {
      void apiFetch<CreatorFollowSnapshot>(
        `/creators/${encodeURIComponent(slug)}/follow-status`
      ).then(result => {
        if (active) setSnapshot(result);
      }).catch(() => {
        if (active) setNotice(en ? 'Subscription status is temporarily unavailable.'
          : 'État de ton abonnement momentanément indisponible.');
      }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [slug, en]);

  async function retry() {
    if (busy || loading) return;
    setBusy(true);
    setNotice('');
    try {
      await load();
    } catch {
      setSnapshot(null);
      setNotice(tr('Impossible de vérifier ton abonnement. Réessaie.',
        'Could not check your subscription. Try again.'));
    } finally { setBusy(false); }
  }

  async function change() {
    const action = creatorFollowAction(signedIn, snapshot);
    if (busy || action !== 'follow' && action !== 'unfollow') return;
    setBusy(true);
    setNotice('');
    try {
      const result = await apiFetch<CreatorFollowMutation>(
        `/creators/${encodeURIComponent(slug)}/follow`,
        { method: action === 'follow' ? 'PUT' : 'DELETE' }
      );
      setSnapshot(previous =>
        previous ? applyCreatorFollowMutation(previous, result) : null
      );
      try {
        await load();
      } catch {
        // The write succeeded; avoid ambiguous repeat actions.
        setSnapshot(null);
        setNotice(tr('Abonnement modifié. Actualise son état pour continuer.',
          'Subscription updated. Refresh its status before continuing.'));
      }
    } catch (cause) {
      // The network may fail after the server accepted the mutation.
      setSnapshot(null);
      setNotice(cause instanceof Error ? cause.message :
        tr('Action impossible. Vérifie ton abonnement avant de réessayer.',
          'Could not complete the action. Check your status before retrying.'));
    } finally { setBusy(false); }
  }

  const action = creatorFollowAction(signedIn, snapshot);
  const total = snapshot?.followerCount ?? initialFollowerCount;
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }} aria-live="polite">
        {total.toLocaleString(en ? 'en-US' : 'fr-FR')}{' '}
        {en ? (total === 1 ? 'follower' : 'followers')
          : (total === 1 ? 'abonné' : 'abonnés')}
      </p>
      {action === 'login' ? (
        <Link className="btn btn-primary" href="/login">
          {tr('Se connecter pour suivre', 'Sign in to follow')}
        </Link>
      ) : action === 'owner' ? (
        <Link className="btn" href="/settings/creator">
          {tr('Modifier ma page', 'Edit my page')}
        </Link>
      ) : action === 'refresh' ? (
        <button type="button" className="btn" disabled={busy || loading}
          onClick={() => void retry()}>
          {loading || busy ? tr('Vérification…', 'Checking…')
            : tr('Vérifier mon abonnement', 'Check subscription')}
        </button>
      ) : (
        <button type="button" className={action === 'unfollow' ? 'btn' : 'btn btn-primary'}
          onClick={() => void change()} disabled={busy}
          aria-pressed={action === 'unfollow'}>
          {busy ? tr('Enregistrement…', 'Saving…') :
            action === 'unfollow' ? tr('Ne plus suivre', 'Unfollow') : tr('Suivre', 'Follow')}
        </button>
      )}
      {notice ? <p role="alert" style={{ color: 'var(--orange)', margin: 0 }}>{notice}</p> : null}
    </div>
  );
}
