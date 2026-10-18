'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../lib/use-session';
import { useI18n } from '../../components/i18n-provider';
import { apiFetch } from '../../lib/api';
import { getSocialGiftCatalog, type SocialGiftDefinition } from '../../lib/social-gifts';
import styles from './marketplace.module.css';

type CosmeticOffer = {
  id: string;
  key: string;
  version: number;
  itemId: string;
  priceKnowCoins: number;
  owned: boolean;
  affordable: boolean;
  item: {
    name: string;
    description: string | null;
    previewUrl: string | null;
    slot: string;
    rarity: string;
  };
};
type ShopResponse = { offers: CosmeticOffer[]; wallet: { balance: number } };
type MarketEntry = {
  id: string;
  kind: 'gift' | 'style';
  name: string;
  description: string;
  price: number;
  visual: string;
  image: string | null;
  owned: boolean;
  href: string;
  offer?: CosmeticOffer;
};
type Filter = 'all' | 'gift' | 'style';

function purchaseId(offerId: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  return ('web-market-' + offerId.slice(0, 12) + '-' + random).slice(0, 96);
}

export default function MarketplacePage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [gifts, setGifts] = useState<SocialGiftDefinition[]>([]);
  const [offers, setOffers] = useState<CosmeticOffer[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedCatalogs, setFailedCatalogs] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [dialogError, setDialogError] = useState('');
  const purchaseKeys = useRef<Record<string, string>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    const results = await Promise.allSettled([
      getSocialGiftCatalog(),
      apiFetch<ShopResponse>('/cosmetics/shop'),
    ]);
    const [giftResult, cosmeticsResult] = results;
    setGifts(giftResult.status === 'fulfilled'
      ? giftResult.value.filter(gift => gift.active)
      : []);
    if (cosmeticsResult.status === 'fulfilled') {
      setOffers(cosmeticsResult.value.offers);
      setWalletBalance(cosmeticsResult.value.wallet.balance);
    } else if (!refresh) {
      setOffers([]);
      setWalletBalance(null);
    }
    setFailedCatalogs(results.filter(result => result.status === 'rejected').length);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [sessionLoading, user, load]);

  const entries = useMemo<MarketEntry[]>(() => {
    const giftEntries: MarketEntry[] = gifts.map(gift => ({
      id: 'gift:' + gift.key,
      kind: 'gift',
      name: gift.name,
      description: gift.description,
      price: gift.priceKnowCoins,
      visual: gift.emoji,
      image: null,
      owned: false,
      href: '/gifts'
    }));
    const styleEntries: MarketEntry[] = offers.map(offer => ({
      id: 'style:' + offer.id,
      kind: 'style',
      name: offer.item.name,
      description: offer.item.description ?? '',
      price: offer.priceKnowCoins,
      visual: '✦',
      image: offer.item.previewUrl,
      owned: offer.owned,
      href: '/cosmetics/shop',
      offer
    }));
    return [...giftEntries, ...styleEntries];
  }, [gifts, offers]);

  const visible = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return entries.filter(entry =>
      (filter === 'all' || entry.kind === filter) &&
      (!normalized ||
        (entry.name + ' ' + entry.description).toLocaleLowerCase().includes(normalized))
    );
  }, [entries, search, filter]);

  const selected = entries.find(entry => entry.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) {
      lastTrigger.current?.focus();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [selectedId]);

  const closeDetails = () => {
    if (busyOfferId) return;
    setSelectedId(null);
    setConfirming(false);
    setDialogError('');
  };

  const purchase = async () => {
    const offer = selected?.offer;
    if (!offer || offer.owned || !offer.affordable || busyOfferId) return;
    setBusyOfferId(offer.id);
    setDialogError('');
    // Retain the same idempotency key if the response is lost.
    const clientPurchaseId = purchaseKeys.current[offer.id] ?? purchaseId(offer.id);
    purchaseKeys.current[offer.id] = clientPurchaseId;
    try {
      const result = await apiFetch<{
        replayed: boolean;
        ledgerEntry: { balanceAfter: number };
      }>('/cosmetics/shop/purchases', {
        method: 'POST',
        body: JSON.stringify({ offerId: offer.id, clientPurchaseId })
      });
      delete purchaseKeys.current[offer.id];
      setOffers(current => current.map(item =>
        item.id === offer.id ? { ...item, owned: true, affordable: false } : item
      ));
      setWalletBalance(result.ledgerEntry.balanceAfter);
      setFeedback(result.replayed
        ? (en ? 'This purchase was already recorded. No second charge.' : 'Cet achat était déjà enregistré. Aucun deuxième débit.')
        : (en ? offer.item.name + ' added to your collection.' : offer.item.name + ' ajouté à ta collection.'));
      setSelectedId(null);
      setConfirming(false);
      void load(true);
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message :
        (en ? 'Purchase failed. Retry safely.' : 'Achat impossible. Réessaie sans double débit.'));
    } finally {
      setBusyOfferId(null);
    }
  };

  if (sessionLoading || !user) {
    return <main className={styles.market}><p>{en ? 'Opening KnowMe…' : 'Ouverture de KnowMe…'}</p></main>;
  }

  return (
    <main className={styles.market}>
      <header className={styles.header}>
        <Link href="/feed" className={styles.back} aria-label={en ? 'Back home' : 'Retour à l’accueil'}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m14.5 5-7 7 7 7"/>
          </svg>
        </Link>
        <div className={styles.identity}>
          <h1>Marketplace</h1>
          <p>{en ? 'Gifts and personalization' : 'Cadeaux et personnalisations'}</p>
        </div>
        <Link className={styles.wallet} href="/wallet" aria-label={en ? 'My KnowCoins wallet' : 'Mon portefeuille KnowCoins'}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="15" rx="4"/>
            <path d="M15 12h6M6 5V3h12"/>
          </svg>
        </Link>
      </header>

      {walletBalance !== null && (
        <Link className={styles.balance} href="/wallet">
          <span>{en ? 'Available balance' : 'Solde disponible'}</span>
          <strong>{walletBalance.toLocaleString(en ? 'en-US' : 'fr-FR')} KnowCoins</strong>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <div className={styles.search}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.7" cy="10.7" r="7.2"/><path d="m16 16 5 5"/>
        </svg>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          aria-label={en ? 'Search marketplace' : 'Rechercher dans la marketplace'}
          placeholder={en ? 'Search gifts, styles…' : 'Rechercher des cadeaux, styles…'} />
        {search && <button type="button" aria-label={en ? 'Clear search' : 'Effacer la recherche'}
          onClick={() => setSearch('')}>×</button>}
      </div>

      <div className={styles.filters} role="group" aria-label={en ? 'Marketplace categories' : 'Catégories de la marketplace'}>
        {([
          ['all', en ? 'All' : 'Tout'],
          ['gift', en ? 'Gifts' : 'Cadeaux'],
          ['style', en ? 'Styles' : 'Personnalisation'],
        ] as [Filter, string][]).map(([value, title]) => (
          <button key={value} type="button" className={filter === value ? styles.current : ''}
            aria-pressed={filter === value} onClick={() => setFilter(value)}>{title}</button>
        ))}
      </div>

      <nav className={styles.shortcuts} aria-label={en ? 'Purchases and collections' : 'Achats et collections'}>
        <Link href="/gifts">
          <span aria-hidden="true" className={styles.shortcutIcon}>🎁</span>
          <span>{en ? 'Send a gift' : 'Offrir un cadeau'}</span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link href="/cosmetics">
          <span aria-hidden="true" className={styles.shortcutIcon}>✦</span>
          <span>{en ? 'My collection' : 'Ma collection'}</span>
          <span aria-hidden="true">›</span>
        </Link>
      </nav>

      {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}

      <section className={styles.catalog} aria-label={en ? 'Marketplace catalogue' : 'Catalogue de la marketplace'}>
        <div className={styles.catalogHeader}>
          <h2>{filter === 'gift' ? (en ? 'Gifts' : 'Cadeaux') :
            filter === 'style' ? (en ? 'Customization' : 'Personnalisation') :
              (en ? 'Discover' : 'Découvrir')}</h2>
          <button type="button" onClick={() => void load(true)} disabled={refreshing || loading}
            aria-label={en ? 'Refresh the marketplace' : 'Actualiser la marketplace'}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7a8 8 0 1 0 .5 7M20 3v5h-5"/>
            </svg>
          </button>
        </div>

        {loading ? <div className={styles.skeleton} aria-label={en ? 'Loading catalogue' : 'Chargement du catalogue'}>
          {Array.from({length:6}, (_, index) => <div key={index} className={styles.skeletonItem}/>)}
        </div> : visible.length ? <div className={styles.items}>
          {visible.map(entry => (
            <button key={entry.id} type="button" className={styles.item}
              onClick={event => {
                lastTrigger.current = event.currentTarget;
                setFeedback('');
                setDialogError('');
                setConfirming(false);
                setSelectedId(entry.id);
              }}
              aria-label={(en ? 'View details for ' : 'Voir les détails de ') + entry.name + ', ' +
                entry.price.toLocaleString(en ? 'en-US' : 'fr-FR') + ' KnowCoins'}>
              <span className={styles.preview}>
                {entry.image
                  ? <img src={entry.image} alt="" loading="lazy" />
                  : <span aria-hidden="true">{entry.visual}</span>}
              </span>
              <span className={styles.itemBody}>
                <strong>{entry.name}</strong>
                <small className={styles.description}>{entry.description}</small>
                <span className={styles.price}>
                  {entry.owned ? (en ? 'Owned' : 'Déjà obtenu') :
                    entry.price.toLocaleString(en ? 'en-US' : 'fr-FR') + ' KnowCoins'}
                </span>
              </span>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div> : <div className={styles.empty} role="status">
          <p>{failedCatalogs === 2
            ? (en ? 'The marketplace is temporarily unavailable.' : 'La marketplace est momentanément indisponible.')
            : search.trim()
              ? (en ? 'No matching items.' : 'Aucun article correspondant.')
              : (en ? 'Nothing to display in this category.' : 'Aucun article à afficher dans cette catégorie.')}
          </p>
          {failedCatalogs === 2 && <button type="button" onClick={() => void load(true)} disabled={refreshing}>
            {en ? 'Try again' : 'Réessayer'}
          </button>}
        </div>}

        {!loading && failedCatalogs === 1 && <p className={styles.notice} role="status">
          {en ? 'Some items could not be loaded. Try refreshing.' : 'Certains articles ne sont pas accessibles. Tu peux actualiser.'}
        </p>}
      </section>

      {selected && (
        <dialog ref={dialogRef} className={styles.purchaseDialog}
          aria-labelledby="marketplace-detail-title"
          onCancel={event => { event.preventDefault(); closeDetails(); }}>
          <div className={styles.dialogHeading}>
            <span>{selected.kind === 'gift' ? (en ? 'Gift' : 'Cadeau') : (en ? 'Personalization' : 'Personnalisation')}</span>
            <button type="button" disabled={Boolean(busyOfferId)}
              aria-label={en ? 'Close item details' : 'Fermer les détails'}
              onClick={closeDetails}>×</button>
          </div>
          <div className={styles.dialogPreview}>
            {selected.image
              ? <img src={selected.image} alt="" />
              : <span aria-hidden="true">{selected.visual}</span>}
          </div>
          <h2 id="marketplace-detail-title">{selected.name}</h2>
          {selected.description && <p className={styles.dialogDescription}>{selected.description}</p>}
          <div className={styles.dialogPrice}>
            <span>{en ? 'Price' : 'Prix'}</span>
            <strong>{selected.price.toLocaleString(en ? 'en-US' : 'fr-FR')} KnowCoins</strong>
          </div>
          {selected.offer && walletBalance !== null && (
            <div className={styles.dialogPrice}>
              <span>{en ? 'Your balance' : 'Ton solde'}</span>
              <strong>{walletBalance.toLocaleString(en ? 'en-US' : 'fr-FR')} KnowCoins</strong>
            </div>
          )}
          {dialogError && <p className={styles.dialogError} role="alert">{dialogError}</p>}
          <div className={styles.dialogActions}>
            {selected.kind === 'gift' ? (
              <Link className={styles.primaryAction} href="/gifts">
                {en ? 'Choose a recipient' : 'Choisir un destinataire'}
              </Link>
            ) : selected.owned ? (
              <Link className={styles.primaryAction} href="/cosmetics">
                {en ? 'View my collection' : 'Voir ma collection'}
              </Link>
            ) : !selected.offer?.affordable ? (
              <Link className={styles.primaryAction} href="/wallet">
                {en ? 'Insufficient KnowCoins · View wallet' : 'Solde insuffisant · Voir le portefeuille'}
              </Link>
            ) : confirming ? (
              <>
                <p className={styles.confirmText}>
                  {en ? 'Confirm purchase of' : 'Confirmer l’achat de'} <strong>{selected.name}</strong>
                  {' · '}{selected.price.toLocaleString(en ? 'en-US' : 'fr-FR')} KnowCoins
                </p>
                <button type="button" className={styles.primaryAction}
                  disabled={Boolean(busyOfferId)} onClick={() => void purchase()}>
                  {busyOfferId ? (en ? 'Processing…' : 'Traitement…') :
                    (en ? 'Confirm and pay' : 'Confirmer et payer')}
                </button>
                <button type="button" className={styles.secondaryAction}
                  disabled={Boolean(busyOfferId)} onClick={() => setConfirming(false)}>
                  {en ? 'Back' : 'Retour'}
                </button>
              </>
            ) : (
              <button type="button" className={styles.primaryAction}
                onClick={() => setConfirming(true)}>
                {en ? 'Continue to purchase' : 'Continuer vers l’achat'}
              </button>
            )}
            {!confirming && (
              <button type="button" className={styles.secondaryAction}
                disabled={Boolean(busyOfferId)} onClick={closeDetails}>
                {en ? 'Cancel' : 'Annuler'}
              </button>
            )}
          </div>
        </dialog>
      )}
    </main>
  );
}
