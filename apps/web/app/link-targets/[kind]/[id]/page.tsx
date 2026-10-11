'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type ResolvedTarget = {
  kind: string;
  id: string;
  webPath: string;
  context: Record<string, string>;
};

export default function LinkedContentPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const { loading } = useSession({ required: true });
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    let active = true;
    void apiFetch<ResolvedTarget>(`/link-targets/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`)
      .then((result) => {
        if (active && result.webPath.startsWith('/') && !result.webPath.startsWith('//')) {
          router.replace(result.webPath);
        }
      })
      .catch(() => {
        if (active) setError('Ce contenu a été supprimé, a expiré ou ne vous est pas accessible.');
      });
    return () => { active = false; };
  }, [loading, kind, id, router]);

  return (
    <main className="shell">
      <section className="card stack" role={error ? 'alert' : 'status'}>
        <h1>{error ? 'Lien indisponible' : 'Ouverture du contenu…'}</h1>
        <p>{error || 'KnowMe vérifie vos droits avant d’ouvrir cet élément.'}</p>
        {error && <Link href="/discover" className="btn">Retour à Découvrir</Link>}
      </section>
    </main>
  );
}
