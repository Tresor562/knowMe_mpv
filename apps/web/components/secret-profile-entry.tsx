'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type PublicSecretSummary = {
  slug: string;
  prompt: string;
  presentation: string;
};

export function SecretProfileEntry({ username }: { username: string }) {
  const [secret, setSecret] = useState<PublicSecretSummary | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<PublicSecretSummary>(
      `/knowme-secret/public/${encodeURIComponent(username)}?entry=PUBLIC_PROFILE_CTA`
    )
      .then((data) => {
        if (active) setSecret(data);
      })
      .catch(() => {
        if (active) setSecret(null);
      });
    return () => {
      active = false;
    };
  }, [username]);

  if (!secret) return null;

  return (
    <section
      id="knowme-secret"
      className="card"
      style={{
        padding: 22,
        marginTop: 22,
        border: '1px solid var(--mint)',
        background: 'linear-gradient(135deg,rgba(69,230,189,.08),rgba(255,138,61,.06))'
      }}
    >
      <small style={{ color: 'var(--mint)' }}>🕵️ KNOWME SECRET ACTIVÉ</small>
      <h2>Dis-lui quelque chose anonymement</h2>
      <p style={{ color: 'var(--muted)' }}>{secret.presentation}</p>
      <Link
        className="btn btn-primary"
        href={`/secret/${encodeURIComponent(secret.slug)}?entry=PUBLIC_PROFILE_CTA`}
      >
        Envoyer un message anonyme
      </Link>
      <small style={{ display: 'block', color: 'var(--muted)', marginTop: 10 }}>
        Ton identité ne sera pas affichée au destinataire. Les abus peuvent être bloqués et signalés.
      </small>
    </section>
  );
}
