'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { officialApkFromUpdateResponse, type OfficialApkRelease } from '../../../lib/official-apk-listing';
import { useSession } from '../../../lib/use-session';
import styles from './apks.module.css';

type Status = 'loading' | 'available' | 'none' | 'error';

export default function MarketplaceApksPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [status, setStatus] = useState<Status>('loading');
  const [release, setRelease] = useState<OfficialApkRelease | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    setCopied(false);
    try {
      const result = await apiFetch<unknown>('/mobile-updates/android');
      const next = officialApkFromUpdateResponse(result);
      setRelease(next);
      setStatus(next ? 'available' : 'none');
    } catch {
      setRelease(null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void reload();
  }, [reload, sessionLoading, user]);

  const copyDigest = async () => {
    if (!release) return;
    try {
      await navigator.clipboard.writeText(release.sha256);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/marketplace" aria-label={en ? 'Return to marketplace' : 'Retour à la Marketplace'} className={styles.back}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className={styles.heading}>
          <h1>{en ? 'Apps & APKs' : 'Applications et APK'}</h1>
          <p>{en ? 'Verified releases from KnowMe' : 'Versions publiées par KnowMe'}</p>
        </div>
        <button type="button" className={styles.refresh} onClick={() => void reload()}
          disabled={status === 'loading' || sessionLoading}
          aria-label={en ? 'Refresh official APK' : 'Actualiser l’APK officielle'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 7a8 8 0 1 0 .5 7M20 3v5h-5"/>
          </svg>
        </button>
      </header>

      <section className={styles.intro}>
        <h2>{en ? 'Official KnowMe Android' : 'KnowMe Android officiel'}</h2>
        <p>{en
          ? 'Only the latest release announced by the KnowMe server appears here. Third-party APK uploads are not enabled.'
          : 'Seule la version annoncée par le serveur KnowMe apparaît ici. La publication d’APK tiers n’est pas encore activée.'}</p>
      </section>

      {status === 'loading' || sessionLoading || !user ? (
        <div className={styles.state} role="status">{en ? 'Checking the release…' : 'Vérification de la version…'}</div>
      ) : status === 'error' ? (
        <div className={styles.state} role="alert">
          <p>{en ? 'Unable to contact the KnowMe update server.' : 'Impossible de joindre le serveur de mises à jour KnowMe.'}</p>
          <button type="button" onClick={() => void reload()}>{en ? 'Retry' : 'Réessayer'}</button>
        </div>
      ) : !release ? (
        <div className={styles.state} role="status">
          <p>{en ? 'No verified APK is currently published.' : 'Aucune APK vérifiée n’est publiée pour le moment.'}</p>
          <p>{en ? 'This is not an installation failure. Nothing will be downloaded without a release.' :
            'Ce n’est pas une erreur d’installation. Aucun fichier n’est proposé sans version publiée.'}</p>
        </div>
      ) : (
        <article className={styles.release}>
          <div className={styles.appHeading}>
            <div className={styles.logo} aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                <rect x="5" y="3" width="14" height="18" rx="3" />
                <path d="M10 17h4M9 7h6v6H9z"/>
              </svg>
            </div>
            <div>
              <h3>KnowMe</h3>
              <p>{en ? 'Android application' : 'Application Android'}</p>
            </div>
          </div>
          <dl className={styles.properties}>
            <div><dt>{en ? 'Version' : 'Version'}</dt><dd>{release.version}</dd></div>
            <div><dt>{en ? 'Android version code' : 'Code de version Android'}</dt><dd>{release.versionCode}</dd></div>
            <div><dt>{en ? 'Source' : 'Provenance'}</dt>
              <dd>{new URL(release.url).hostname === 'github.com' ? 'GitHub · Tresor562/knowMe_mpv' : 'Serveur de mises à jour KnowMe'}</dd>
            </div>
          </dl>
          {release.notes && (
            <div className={styles.notes}>
              <strong>{en ? 'Release notes' : 'Notes de version'}</strong>
              <p>{release.notes}</p>
            </div>
          )}
          <div className={styles.checksum}>
            <strong>{en ? 'SHA-256 checksum' : 'Empreinte SHA-256'}</strong>
            <code>{release.sha256}</code>
            <button type="button" onClick={() => void copyDigest()}>
              {copied ? (en ? 'Copied' : 'Copiée') : (en ? 'Copy checksum' : 'Copier l’empreinte')}
            </button>
          </div>
          <a className={styles.download} href={release.url} target="_blank" rel="noopener noreferrer"
            aria-label={(en ? 'Open official APK download for KnowMe version ' : 'Ouvrir le téléchargement officiel KnowMe version ') + release.version}>
            {en ? 'Open official APK download' : 'Ouvrir le téléchargement APK officiel'}
          </a>
          <p className={styles.caution}>{en
            ? 'Android will ask for your authorization before installation. Only install APKs from sources you trust and compare their fingerprints.'
            : 'Android demandera ton autorisation avant l’installation. Vérifie la provenance et l’empreinte du fichier avant de l’installer.'}</p>
        </article>
      )}
      <p className={styles.footer}>{en
        ? 'Public app listings, creator uploads and reviews require a separate verified and moderated catalog.'
        : 'Les publications d’applications, créateurs et avis nécessitent un catalogue distinct, vérifié et modéré.'}</p>
    </main>
  );
}
