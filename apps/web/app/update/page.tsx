'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AndroidRelease = {
  versionCode: number;
  version: string;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};

const preview = 'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.2-preview/KnowMe-1.1.2-preview.apk';

export default function AndroidUpdatesPage() {
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [status, setStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/knowme/mobile-updates/android', {
      cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' }
    }).then(async response => {
      if (!response.ok) throw new Error('Le serveur ne répond pas');
      const feed = await response.json() as { release: AndroidRelease | null };
      if (!feed.release || !/^https:\/\//.test(feed.release.url)) throw new Error('Aucune version');
      if (!/^([a-f0-9]{64})$/i.test(feed.release.sha256)) throw new Error('Empreinte invalide');
      setRelease(feed.release);
      setStatus('available');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('unavailable');
    });
    return () => controller.abort();
  }, []);

  const link = status === 'available' ? release?.url : preview;
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', padding: 'clamp(18px,5vw,56px) 16px 100px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <nav style={{ marginBottom: 24 }}>
          <Link href="/" style={{ color: 'var(--mint)', fontWeight: 700, textDecoration: 'none' }}>← KnowMe</Link>
        </nav>
        <div style={{ border: '1px solid var(--border)', borderRadius: 28, background: 'var(--surface)', padding: 'clamp(20px,5vw,32px)', display: 'grid', gap: 18 }}>
          <span style={{ color: 'var(--mint)', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>KNOWME · ANDROID</span>
          <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.15 }}>Mettre à jour KnowMe</h1>
          <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--muted)' }}>
            La page de mise à jour reste accessible depuis ton navigateur, même si la page des paramètres de ton ancienne APK ne s’ouvre pas.
          </p>
          <div style={{ borderRadius: 16, padding: 15, background: 'var(--bg-accent)', display: 'grid', gap: 6 }}>
            <strong>{status === 'available' ? `KnowMe ${release?.version} disponible` : 'KnowMe 1.1.2 — préversion Android'}</strong>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>
              {status === 'loading' ? 'Vérification auprès du serveur…'
                : status === 'unavailable' ? 'Le contrôle automatique est momentanément indisponible. Le lien de la préversion vérifiée reste accessible.'
                  : 'Version Android annoncée par le serveur KnowMe.'}
            </span>
          </div>
          <a href={link} rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            minHeight: 54, padding: 12, borderRadius: 17,
            background: 'var(--mint)', color: 'var(--on-primary)', fontWeight: 800, textDecoration: 'none'
          }}>
            Télécharger l’APK {release?.version ?? '1.1.2'}
          </a>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
            Préversion signée avec une clé Android de développement. Elle ne remplace l’application existante que si leurs signatures correspondent.
          </p>
          <section style={{ display: 'grid', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Installation sur Android</h2>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.7 }}>
              Appuie sur « Télécharger », puis ouvre l’APK depuis les téléchargements de ton téléphone. Confirme « Mettre à jour » dans Android lorsqu’il le propose. Autorise l’installation depuis ton navigateur si Android le demande.
            </p>
            <p style={{ margin: 0, color: 'var(--text)', fontWeight: 700, lineHeight: 1.55 }}>
              Ne désinstalle pas l’ancienne APK : cela pourrait supprimer des données locales. Si Android indique que l’application est incompatible, arrête-toi et conserve la version déjà installée.
            </p>
          </section>
          <Link href="/" style={{ textAlign: 'center', color: 'var(--mint)', fontWeight: 700 }}>Retour à KnowMe</Link>
        </div>
      </div>
    </main>
  );
}
