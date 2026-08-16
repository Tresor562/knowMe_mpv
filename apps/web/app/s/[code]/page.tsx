'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';

type LinkKind =
  | 'profile'
  | 'challenge'
  | 'community'
  | 'event'
  | 'gift'
  | 'sticker-pack';

type ShortLinkPreview = {
  code: string;
  kind: LinkKind;
  expiresAt: string | null;
  policy: {
    internalKnowMeDestinationOnly: boolean;
    arbitraryExternalUrlsAllowed: boolean;
    targetIdExposedBeforeContinuation: boolean;
    authorizationRevalidated: boolean;
    contractVersion: 'v1';
  };
};

type ShortLinkResolution = {
  code: string;
  kind: LinkKind;
  universalPath: string;
  deepLink: string;
  expiresAt: string | null;
};

const LABELS: Record<LinkKind, string> = {
  profile: 'un profil KnowMe',
  challenge: 'un défi KnowMe',
  community: 'une communauté KnowMe',
  event: 'un événement KnowMe',
  gift: 'un cadeau KnowMe',
  'sticker-pack': 'un pack de stickers KnowMe'
};

function safeUniversalPath(value: string) {
  return /^\/open\/v1\/(profile|challenge|community|event|gift|sticker-pack)\/[A-Za-z0-9_-]{6,128}$/.test(
    value
  );
}

export default function ShortLinkPreviewPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = typeof params.code === 'string' ? params.code : '';
  const [preview, setPreview] = useState<ShortLinkPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!code) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    apiFetch<ShortLinkPreview>(`/short-links/preview/${encodeURIComponent(code)}`)
      .then((result) => {
        if (cancelled) return;
        if (
          !result.policy.internalKnowMeDestinationOnly ||
          result.policy.arbitraryExternalUrlsAllowed ||
          result.policy.targetIdExposedBeforeContinuation ||
          !result.policy.authorizationRevalidated ||
          result.policy.contractVersion !== 'v1'
        ) {
          setFailed(true);
          return;
        }
        setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const expiry = useMemo(() => {
    if (!preview?.expiresAt) return null;
    const date = new Date(preview.expiresAt);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : null;
  }, [preview?.expiresAt]);

  async function continueInsideKnowMe() {
    if (!preview || continuing) return;
    setContinuing(true);
    try {
      const resolution = await apiFetch<ShortLinkResolution>(
        `/short-links/resolve/${encodeURIComponent(preview.code)}`
      );
      if (
        resolution.code !== preview.code ||
        resolution.kind !== preview.kind ||
        !safeUniversalPath(resolution.universalPath)
      ) {
        throw new Error('Résolution de lien refusée.');
      }
      router.push(resolution.universalPath);
    } catch {
      setFailed(true);
    } finally {
      setContinuing(false);
    }
  }

  if (failed) {
    return (
      <main className="shell stack">
        <section className="card stack">
          <p className="eyebrow">Lien KnowMe</p>
          <h1>Lien indisponible</h1>
          <p>
            Ce lien est inconnu, expiré, révoqué ou n’est plus autorisé. Aucune autre
            destination ne sera ouverte automatiquement.
          </p>
          <a className="button" href="/discover">
            Retourner vers Découvrir
          </a>
        </section>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="shell stack">
        <section className="card stack" aria-busy="true">
          <p className="eyebrow">Lien KnowMe</p>
          <h1>Vérification du lien…</h1>
          <p role="status">KnowMe vérifie la destination avant de continuer.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell stack">
      <section className="card stack">
        <p className="eyebrow">Aperçu sécurisé</p>
        <h1>Ce lien ouvre {LABELS[preview.kind]}.</h1>
        <p>
          La destination reste interne à KnowMe et son autorisation sera vérifiée de
          nouveau lorsque tu continueras. Le lien ne peut pas te rediriger vers une URL
          externe fournie par son créateur.
        </p>
        {expiry ? <p>Expiration prévue : {expiry}</p> : null}
        <button
          className="button"
          type="button"
          disabled={continuing}
          onClick={() => void continueInsideKnowMe()}
        >
          {continuing ? 'Vérification…' : 'Continuer dans KnowMe'}
        </button>
        <a href="/discover">Annuler et aller vers Découvrir</a>
      </section>
    </main>
  );
}
