'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type ResolvedShortLink = {
  code: string;
  webPath: string;
  deepLink: string;
  expiresAt: string | null;
};

export default function ShortLinkPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = typeof params.code === 'string' ? params.code : '';
    if (!code) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    apiFetch<ResolvedShortLink>(`/short-links/resolve/${encodeURIComponent(code)}`)
      .then((resolved) => {
        if (cancelled) return;
        if (!resolved.webPath.startsWith('/') || resolved.webPath.startsWith('//')) {
          setFailed(true);
          return;
        }
        router.replace(resolved.webPath);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [params.code, router]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Lien KnowMe indisponible</h1>
        <p className="text-sm opacity-70">
          Ce lien est inconnu, expiré ou a été révoqué.
        </p>
        <Link href="/" className="underline">
          Retour à KnowMe
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 text-center">
      <p role="status">Ouverture du contenu KnowMe…</p>
    </main>
  );
}
