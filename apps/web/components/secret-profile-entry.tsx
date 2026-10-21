'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { KnowMeGlyph } from './knowme-glyph';
import './secret-profile-entry.css';

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
    <section id="knowme-secret" className="km-secret-entry" aria-labelledby="km-secret-entry-title">
      <div className="km-secret-entry-icon" aria-hidden="true"><KnowMeGlyph name="shield" size={23}/></div>
      <div className="km-secret-entry-content">
        <small className="km-secret-entry-eyebrow">KNOWME SECRET ACTIVÉ</small>
        <h2 id="km-secret-entry-title">Dis-lui quelque chose anonymement</h2>
        <p>{secret.presentation}</p>
        <small className="km-secret-entry-privacy">Ton identité ne sera pas affichée au destinataire. Les abus peuvent être bloqués et signalés.</small>
      </div>
      <Link className="km-secret-entry-action"
        href={`/secret/${encodeURIComponent(secret.slug)}?entry=PUBLIC_PROFILE_CTA`}>
        <KnowMeGlyph name="send" size={18}/>
        <span>Envoyer anonymement</span>
      </Link>
    </section>
  );
}
