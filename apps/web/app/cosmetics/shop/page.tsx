'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type CosmeticItem = {
  id: string;
  name: string;
  description: string | null;
  slot: string;
  rarity: string;
  previewUrl: string | null;
};

type CosmeticOffer = {
  id: string;
  key: string;
  version: number;
  itemId: string;
  priceKnowCoins: number;
  owned: boolean;
  affordable: boolean;
  item: CosmeticItem;
};

type ShopResponse = {
  offers: CosmeticOffer[];
  wallet: {
    balance: number;
    version: number;
  };
  rules: {
    currency: string;
    verifiedLedgerRequired: boolean;
    atomicDebitAndOwnership: boolean;
    idempotentPurchases: boolean;
    visualOnly: boolean;
    gameplayEffectsAllowed: boolean;
    paidPriorityAllowed: boolean;
    socialVisibilityBoostAllowed: boolean;
  };
};

type PurchaseReceipt = {
  id: string;
  priceKnowCoins: number;
  purchasedAt: string;
  item: CosmeticItem;
};

type PurchaseHistoryResponse = {
  receipts: PurchaseReceipt[];
};

function purchaseId(offerId: string) {
  const entropy = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `web-${offerId.slice(0, 12)}-${entropy}`.slice(0, 96);
}

export default function CosmeticsShopPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [history, setHistory] = useState<PurchaseHistoryResponse | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [shopResponse, historyResponse] = await Promise.all([
        apiFetch<ShopResponse>('/cosmetics/shop'),
        apiFetch<PurchaseHistoryResponse>('/cosmetics/shop/purchases')
      ]);
      setShop(shopResponse);
      setHistory(historyResponse);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Boutique cosmétique indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const purchasedIds = useMemo(
    () => new Set((history?.receipts ?? []).map((receipt) => receipt.item.id)),
    [history]
  );

  async function purchase(offer: CosmeticOffer) {
    setBusyOfferId(offer.id);
    setMessage('');
    try {
      const result = await apiFetch<{
        replayed: boolean;
        receipt: PurchaseReceipt;
        ledgerEntry: { balanceAfter: number };
      }>('/cosmetics/shop/purchases', {
        method: 'POST',
        body: JSON.stringify({
          offerId: offer.id,
          clientPurchaseId: purchaseId(offer.id)
        })
      });
      setMessage(
        result.replayed
          ? 'Cet achat avait déjà été enregistré. Aucun second débit n’a été effectué.'
          : `${offer.item.name} a été ajouté à ton inventaire. Nouveau solde : ${result.ledgerEntry.balanceAfter} KnowCoins.`
      );
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Achat impossible.');
    } finally {
      setBusyOfferId(null);
    }
  }

  if (sessionLoading || !user || !shop || !history) {
    return <main className="shell"><p>{message || 'Chargement de la boutique cosmétique…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>BOUTIQUE COSMÉTIQUE KNOWME</small>
        <h1>Des apparences en KnowCoins, jamais des avantages</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 780 }}>
          Chaque achat débite le registre KnowCoins et crée la possession dans la même transaction.
          Un rejeu du même achat retourne le reçu existant sans second débit.
        </p>
      </header>

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <small>SOLDE DISPONIBLE</small>
            <h2 style={{ marginBottom: 4 }}>{shop.wallet.balance.toLocaleString('fr-FR')} KnowCoins</h2>
            <span style={{ color: 'var(--muted)' }}>Version de portefeuille {shop.wallet.version}</span>
          </div>
          <a className="btn" href="/cosmetics">Voir mon inventaire</a>
        </div>
      </section>

      {message && <p role="status" style={{ marginTop: 18 }}>{message}</p>}

      <section style={{ display: 'grid', gap: 18, marginTop: 24 }}>
        {shop.offers.length === 0 && (
          <div className="card" style={{ padding: 20 }}>
            <h2>Aucune offre active</h2>
            <p style={{ color: 'var(--muted)' }}>Les objets gratuits de ton inventaire restent disponibles.</p>
          </div>
        )}

        {shop.offers.map((offer) => {
          const owned = offer.owned || purchasedIds.has(offer.itemId);
          return (
            <article className="card" style={{ padding: 20 }} key={offer.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 700 }}>
                  <small style={{ color: 'var(--mint)' }}>
                    {offer.item.rarity} · {offer.item.slot} · OFFRE V{offer.version}
                  </small>
                  <h2>{offer.item.name}</h2>
                  <p style={{ color: 'var(--muted)' }}>
                    {offer.item.description ?? 'Objet cosmétique purement visuel.'}
                  </p>
                  <strong>{offer.priceKnowCoins.toLocaleString('fr-FR')} KnowCoins</strong>
                </div>
                <button
                  className={owned ? 'btn' : 'btn btn-primary'}
                  disabled={owned || !offer.affordable || busyOfferId === offer.id}
                  onClick={() => void purchase(offer)}
                >
                  {owned
                    ? 'Déjà possédé'
                    : busyOfferId === offer.id
                      ? 'Validation…'
                      : offer.affordable
                        ? 'Acheter'
                        : 'Solde insuffisant'}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card" style={{ padding: 20, marginTop: 24 }}>
        <h2>Garanties d’équité</h2>
        <p style={{ color: 'var(--muted)' }}>
          Registre vérifié : <strong>{shop.rules.verifiedLedgerRequired ? 'oui' : 'non'}</strong> ·
          Transaction atomique : <strong>{shop.rules.atomicDebitAndOwnership ? 'oui' : 'non'}</strong> ·
          Rejeu idempotent : <strong>{shop.rules.idempotentPurchases ? 'oui' : 'non'}</strong> ·
          Effets de jeu : <strong>{shop.rules.gameplayEffectsAllowed ? 'autorisés' : 'interdits'}</strong> ·
          Priorité payante : <strong>{shop.rules.paidPriorityAllowed ? 'autorisée' : 'interdite'}</strong> ·
          Boost de visibilité : <strong>{shop.rules.socialVisibilityBoostAllowed ? 'autorisé' : 'interdit'}</strong>
        </p>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 24 }}>
        <h2>Historique d’achats</h2>
        {history.receipts.length === 0 && <p>Aucun achat cosmétique enregistré.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {history.receipts.map((receipt) => (
            <div key={receipt.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <strong>{receipt.item.name}</strong>
              <p style={{ color: 'var(--muted)', margin: '4px 0' }}>
                {receipt.priceKnowCoins.toLocaleString('fr-FR')} KnowCoins ·{' '}
                {new Date(receipt.purchasedAt).toLocaleString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
