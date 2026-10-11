'use client';

import { tokenizeKnowMeMentions } from '@knowme/link-contract';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, type ApiError } from '../lib/api';
import { useI18n } from './i18n-provider';

/**
 * Safe text renderer shared by conversations, posts and comments.
 * Only actual @handles are interactive; the API confirms account existence on tap.
 */
export function UsernameMentions({ text, className }: { text: string; className?: string }) {
  const router = useRouter();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState<string | null>(null);

  async function open(username: string) {
    if (checking) return;
    setNotice('');
    setChecking(username);
    try {
      await apiFetch(`/profile-experience/public/${encodeURIComponent(username)}`);
      router.push(`/profile/${encodeURIComponent(username)}`);
    } catch (cause) {
      const status = (cause as ApiError).status;
      setNotice(status === 404
        ? (en ? 'This username does not exist on KnowMe.' : "Ce nom d’utilisateur n’existe pas sur KnowMe.")
        : status === 403 || status === 410
          ? (en ? 'This profile is no longer available.' : "Ce profil n’est plus disponible.")
          : (en ? 'Could not verify this profile. Try again.' : 'Impossible de vérifier ce profil. Réessayer.'));
    } finally {
      setChecking(null);
    }
  }

  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {tokenizeKnowMeMentions(text).map((part, index) => part.kind === 'mention' ? (
        <a
          key={index}
          href={`/profile/${encodeURIComponent(part.username)}`}
          onClick={(event) => { event.preventDefault(); void open(part.username); }}
          aria-label={en ? `View profile ${part.text}` : `Voir le profil ${part.text}`}
          aria-disabled={checking !== null}
          style={{
            color: 'var(--accent, var(--mint, #397ee6))',
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            cursor: checking ? 'progress' : 'pointer'
          }}
        >
          {part.text}
        </a>
      ) : <span key={index}>{part.text}</span>)}
      {notice && (
        <span role="status" style={{
          display: 'block',
          padding: '4px 8px',
          marginTop: 4,
          borderRadius: 10,
          color: 'var(--text, currentColor)',
          background: 'var(--surface-2, transparent)',
          fontSize: 12
        }}>{notice}</span>
      )}
    </span>
  );
}
