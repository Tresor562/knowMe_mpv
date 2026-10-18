'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import { useSession } from '../../../lib/use-session';
import {
  getSocialGiftSent, type SocialGiftSentItem, type SocialGiftPage
} from '../../../lib/social-gifts';
import styles from './history.module.css';

type CosmeticReceipt = {
  id: string;
  priceKnowCoins: number;
  purchasedAt: string;
  item: { id: string; name: string };
};
type CosmeticReceiptsResponse = { receipts: CosmeticReceipt[] };
type Category = 'all' | 'cosmetics' | 'gifts';

function formatDate(value: string, locale: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return locale === 'en' ? 'Date unavailable' : 'Date indisponible';
  return new Date(ms).toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
    dateStyle: 'medium', timeStyle: 'short'
  });
}

export default function MarketplaceHistoryPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [purchases, setPurchases] = useState<CosmeticReceipt[]>([]);
  const [gifts, setGifts] = useState<SocialGiftSentItem[]>([]);
  const [giftCursor, setGiftCursor] = useState<string | null>(null);
  const [purchaseFailed, setPurchaseFailed] = useState(false);
  const [giftFailed, setGiftFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [continuationError, setContinuationError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      apiFetch<CosmeticReceiptsResponse>('/cosmetics/shop/purchases'),
      getSocialGiftSent(undefined, 30)
    ]);
    if (results[0].status === 'fulfilled') {
      setPurchases(results[0].value.receipts);
      setPurchaseFailed(false);
    } else {
      setPurchases([]);
      setPurchaseFailed(true);
    }
    if (results[1].status === 'fulfilled') {
      setGifts(results[1].value.items);
      setGiftCursor(results[1].value.nextCursor);
      setGiftFailed(false);
    } else {
      setGifts([]);
      setGiftCursor(null);
      setGiftFailed(true);
    }
    setContinuationError('');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  const more = async () => {
    if (!giftCursor || loadingMore) return;
    setLoadingMore(true);
    setContinuationError('');
    try {
      const result: SocialGiftPage<SocialGiftSentItem> = await getSocialGiftSent(giftCursor, 30);
      setGifts(old => {
        const seen = new Set(old.map(item => item.id));
        return [...old, ...result.items.filter(item => !seen.has(item.id))];
      });
      setGiftCursor(result.nextCursor);
    } catch {
      setContinuationError(en ? 'Could not load older gifts. Try again.' :
        'Impossible de charger les anciens cadeaux. Réessaie.');
    } finally {
      setLoadingMore(false);
    }
  };

  const entries = useMemo(() => {
    const cosmetics = purchases.map(item => ({
      id: 'cosmetic:' + item.id,
      kind: 'cosmetics' as const,
      name: item.item.name,
      description: en ? 'Cosmetic purchase' : 'Achat de personnalisation',
      date: item.purchasedAt,
      amount: item.priceKnowCoins
    }));
    const sent = gifts.map(item => ({
      id: 'gift:' + item.id,
      kind: 'gifts' as const,
      name: item.gift.name,
      description: (en ? 'Gift for ' : 'Cadeau à ') +
        (item.recipient?.displayName ?? (en ? 'recipient' : 'destinataire')),
      date: item.sentAt,
      amount: item.priceKnowCoins
    }));
    const search = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
    return [...cosmetics, ...sent]
      .filter(item => (filter === 'all' || filter === item.kind) &&
        (!search || (item.name + ' ' + item.description).normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(search)))
      .sort((a,b) => {
        const aDate = Date.parse(a.date);
        const bDate = Date.parse(b.date);
        return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
      });
  }, [purchases, gifts, filter, query, en]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/marketplace"
          aria-label={en ? 'Back to marketplace' : 'Retour à la Marketplace'}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className={styles.heading}>
          <h1>{en ? 'My transactions' : 'Mes transactions'}</h1>
          <p>{en ? 'Verified KnowCoins history' : 'Historique KnowCoins vérifié'}</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load()}
          className={styles.refresh} aria-label={en ? 'Refresh transactions' : 'Actualiser les transactions'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M20 7a8 8 0 1 0 .5 7M20 3v5h-5"/>
          </svg>
        </button>
      </header>

      <p className={styles.intro}>{en
        ? 'Purchases and sent gifts come from your actual server receipts. This does not include incoming gifts or other wallet movements.'
        : 'Les achats et cadeaux envoyés proviennent des reçus du serveur. Les cadeaux reçus et les autres mouvements du portefeuille ne sont pas inclus.'}</p>

      <div className={styles.filters} role="group"
        aria-label={en ? 'Transaction type' : 'Type de transaction'}>
        {([
          ['all', en ? 'All' : 'Tout'],
          ['cosmetics', en ? 'Purchases' : 'Achats'],
          ['gifts', en ? 'Sent gifts' : 'Cadeaux envoyés']
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key}
            className={filter === key ? styles.selected : ''}
            onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      <div className={styles.search}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
        </svg>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
          aria-label={en ? 'Search transaction history' : 'Rechercher dans les transactions'}
          placeholder={en ? 'Search a purchase or gift…' : 'Rechercher un achat ou un cadeau…'} />
      </div>

      {!loading && (purchaseFailed || giftFailed) && (
        <p className={styles.warning} role="status">{purchaseFailed && giftFailed
          ? (en ? 'History unavailable. Retry.' : 'Historique indisponible. Réessaie.')
          : (en ? 'Some transactions could not be loaded; this list is incomplete.' :
            'Certaines transactions sont indisponibles ; la liste est incomplète.')}</p>
      )}

      {loading || sessionLoading || !user ? (
        <p className={styles.empty} role="status">{en ? 'Loading receipts…' : 'Chargement des reçus…'}</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty} role="status">
          {purchaseFailed && giftFailed ? (en ? 'No history could be loaded.' : 'Impossible de charger l’historique.') :
            (en ? 'No matching transactions in the loaded history.' :
              'Aucune transaction correspondante dans l’historique chargé.')}
        </p>
      ) : (
        <section className={styles.rows} aria-label={en ? 'Verified transactions' : 'Transactions vérifiées'}>
          {entries.map(item => (
            <article key={item.id} className={styles.row}>
              <span className={styles.kind} aria-hidden="true">
                {item.kind === 'gifts' ? (
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="4" y="10" width="16" height="11" rx="2"/>
                    <path d="M3 10h18v-4H3zM12 6v15M12 6c-8-1-7-7-3-5 2 1 3 4 3 5 0-2 2-5 4-5 4-2 4 4-4 5"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="m12 2 8 6-3 12H7L4 8zM4 8h16M8 8l4 12 4-12"/>
                  </svg>
                )}
              </span>
              <div className={styles.info}>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <time>{formatDate(item.date, locale)}</time>
              </div>
              <strong className={styles.amount}>
                −{item.amount.toLocaleString(en ? 'en-US' : 'fr-FR')}
                <small>KnowCoins</small>
              </strong>
            </article>
          ))}
        </section>
      )}

      {(filter === 'all' || filter === 'gifts') && giftCursor && (
        <div className={styles.paging}>
          <button type="button" disabled={loadingMore} onClick={() => void more()}>
            {loadingMore ? (en ? 'Loading…' : 'Chargement…') :
              (en ? 'Load older sent gifts' : 'Charger les anciens cadeaux envoyés')}
          </button>
          {continuationError && <p role="alert">{continuationError}</p>}
        </div>
      )}
      <p className={styles.footer}>{en
        ? 'History displays server-authorized events; no prices, receipts or transfers are generated on this page.'
        : 'Cette page affiche uniquement des opérations validées par le serveur ; elle ne génère aucun prix, reçu ou transfert.'}</p>
    </main>
  );
}
