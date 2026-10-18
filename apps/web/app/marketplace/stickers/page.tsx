'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import { useSession } from '../../../lib/use-session';
import styles from './stickers.module.css';

type Sticker = { key: string; version: number; label: string; glyph: string; accessibilityLabel: string };
type Pack = { key: string; version: number; name: string; description: string; stickers: Sticker[] };
type Catalog = { schemaVersion: 1; packs: Pack[]; visualOnly: true; externalAssetAllowed: false };
type Status = 'loading' | 'ready' | 'error';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export default function StickerMarketplacePage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [packs, setPacks] = useState<Pack[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const catalog = await apiFetch<Catalog>('/stickers/catalog');
      if (!catalog || catalog.schemaVersion !== 1 || catalog.visualOnly !== true ||
          catalog.externalAssetAllowed !== false || !Array.isArray(catalog.packs)) {
        throw new Error('Invalid sticker catalog response');
      }
      setPacks(catalog.packs);
      setStatus('ready');
    } catch {
      setPacks([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return packs;
    return packs.filter(pack => normalize([
      pack.name, pack.description,
      ...pack.stickers.flatMap(sticker => [sticker.label, sticker.accessibilityLabel])
    ].join(' ')).includes(q));
  }, [packs, search]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/marketplace" className={styles.back}
          aria-label={en ? 'Return to marketplace' : 'Retour à la Marketplace'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className={styles.heading}>
          <h1>{en ? 'Sticker packs' : 'Packs de stickers'}</h1>
          <p>{en ? 'Official KnowMe collections' : 'Collections officielles KnowMe'}</p>
        </div>
        <button type="button" className={styles.refresh} onClick={() => void load()}
          disabled={status === 'loading' || sessionLoading}
          aria-label={en ? 'Refresh sticker packs' : 'Actualiser les packs'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M20 7a8 8 0 1 0 .5 7M20 3v5h-5" />
          </svg>
        </button>
      </header>
      <section className={styles.intro}>
        <h2>{en ? 'Discover the packs' : 'Découvrir les packs'}</h2>
        <p>{en
          ? 'These packs come from the official KnowMe server. Open any pack to preview, share or copy a sticker link.'
          : 'Ces packs viennent du serveur officiel KnowMe. Ouvre un pack pour découvrir, partager ou copier le lien d’un sticker.'}</p>
      </section>
      <div className={styles.search}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="7.2"/><path d="m16 16 5 5"/>
        </svg>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          aria-label={en ? 'Search sticker packs' : 'Rechercher des packs de stickers'}
          placeholder={en ? 'Search packs, stickers…' : 'Rechercher packs, stickers…'}/>
        {search && <button type="button" onClick={() => setSearch('')}
          aria-label={en ? 'Clear search' : 'Effacer la recherche'}>×</button>}
      </div>
      {status === 'loading' || sessionLoading || !user ? (
        <p className={styles.state} role="status">{en ? 'Loading official packs…' : 'Chargement des packs officiels…'}</p>
      ) : status === 'error' ? (
        <div className={styles.state} role="alert">
          <p>{en ? 'Official sticker packs could not be loaded.' : 'Impossible de charger les packs officiels.'}</p>
          <button type="button" onClick={() => void load()}>{en ? 'Retry' : 'Réessayer'}</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.state} role="status">{en ? 'No matching packs.' : 'Aucun pack correspondant.'}</p>
      ) : (
        <section className={styles.catalog} aria-label={en ? 'Official sticker packs' : 'Packs de stickers officiels'}>
          {filtered.map(pack => (
            <article className={styles.pack} key={pack.key + ':' + pack.version}>
              <div className={styles.packHeading}>
                <h3>{pack.name}</h3>
                <small>{pack.stickers.length} stickers</small>
              </div>
              <p>{pack.description}</p>
              <div className={styles.preview}>
                {pack.stickers.slice(0, 9).map(sticker => (
                  <span key={sticker.key} role="img" aria-label={sticker.accessibilityLabel}
                    title={sticker.label}>{sticker.glyph}</span>
                ))}
              </div>
              <Link className={styles.link} href={'/stickers/' + encodeURIComponent(pack.key)}>
                {en ? 'See this pack' : 'Voir ce pack'}
                <span aria-hidden="true">›</span>
              </Link>
            </article>
          ))}
        </section>
      )}
      <p className={styles.disclaimer}>{en
        ? 'These are visual KnowMe sticker packs, not paid products. Publishing third-party packs requires verified creators and moderation.'
        : 'Ce sont des packs visuels KnowMe, pas des articles payants. La publication de packs tiers demandera un système de créateurs vérifiés et de modération.'}</p>
    </main>
  );
}
