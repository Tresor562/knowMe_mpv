'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CommercePrice,
  CommerceProduct,
  createCheckoutIdempotencyKey,
  createWebCheckout,
  formatMinorAmount,
  getPaymentCatalog,
  getPaymentOrders,
  getPaymentProviders,
  PaymentOrder,
  PaymentProviderConfiguration,
  paymentStatusLabel,
  paymentStatusTone,
  WebPaymentProvider
} from '../../lib/payments';
import { useSession } from '../../lib/use-session';

const LAST_PAYMENT_ORDER_KEY = 'knowme:last-payment-order';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function countryCode(value: string) {
  return value.trim().toUpperCase().slice(0, 2);
}

function currencyCode(value: string) {
  return value.trim().toUpperCase().slice(0, 3);
}

function providerLabel(provider: WebPaymentProvider) {
  return provider === 'FLUTTERWAVE' ? 'Flutterwave' : 'CinetPay';
}

const pillStyle = {
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '7px 10px',
  color: 'var(--muted)',
  fontSize: 12
};

function OrderCard({ order }: { order: PaymentOrder }) {
  return (
    <article className="card" style={{ padding: 18, display: 'grid', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 14,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <strong>{order.productName}</strong>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            {order.provider} · {order.reference}
          </div>
        </div>
        <strong style={{ color: paymentStatusTone(order.status) }}>
          {paymentStatusLabel(order.status)}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{formatMinorAmount(order.expectedAmount, order.currency)}</span>
        <time style={{ color: 'var(--muted)' }}>
          {new Date(order.createdAt).toLocaleString('fr-FR')}
        </time>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn" href={`/payments/orders/${order.id}`}>
          Voir la commande
        </Link>
        {order.checkoutUrl && ['CREATED', 'PENDING'].includes(order.status) ? (
          <a className="btn" href={order.checkoutUrl} rel="noreferrer">
            Reprendre le paiement
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function PaymentsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [catalog, setCatalog] = useState<CommerceProduct[]>([]);
  const [providers, setProviders] = useState<PaymentProviderConfiguration | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [country, setCountry] = useState('BJ');
  const [currency, setCurrency] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [busyPriceId, setBusyPriceId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setStatusMessage('');
    try {
      const [products, configuration] = await Promise.all([
        getPaymentCatalog({
          platform: 'WEB',
          country: countryCode(country),
          currency: currencyCode(currency)
        }),
        getPaymentProviders()
      ]);
      setCatalog(products);
      setProviders(configuration);
    } catch (cause) {
      setStatusMessage(message(cause, 'Le catalogue de paiement est indisponible.'));
    } finally {
      setCatalogLoading(false);
    }
  }, [country, currency]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const page = await getPaymentOrders(undefined, 30);
      setOrders(page.items);
    } catch (cause) {
      setStatusMessage(message(cause, 'L’historique des paiements est indisponible.'));
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const configuredWebProviders = useMemo(() => {
    if (!providers) return [];
    return (['FLUTTERWAVE', 'CINETPAY'] as const).filter(
      (provider) => providers.providers[provider].configured
    );
  }, [providers]);

  async function refreshCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCatalog();
  }

  async function checkout(product: CommerceProduct, price: CommercePrice) {
    if (!user || busyPriceId) return;
    if (price.provider !== 'FLUTTERWAVE' && price.provider !== 'CINETPAY') return;

    setBusyPriceId(price.id);
    setStatusMessage('');
    try {
      const provider = price.provider;
      const selectedCountry = price.countryCode || countryCode(country) || undefined;
      const result = await createWebCheckout(
        {
          productKey: product.key,
          provider,
          countryCode: selectedCountry,
          currency: price.currency,
          phoneNumber: phoneNumber.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          customerCountryCode: countryCode(country) || undefined,
          state: state.trim() || undefined,
          postalCode: postalCode.trim() || undefined
        },
        createCheckoutIdempotencyKey(product.key, provider)
      );

      window.sessionStorage.setItem(LAST_PAYMENT_ORDER_KEY, result.order.id);
      window.sessionStorage.setItem('knowme:last-payment-reference', result.order.reference);
      if (!result.order.checkoutUrl) {
        throw new Error('Le fournisseur n’a retourné aucune URL de paiement sécurisée.');
      }
      window.location.assign(result.order.checkoutUrl);
    } catch (cause) {
      setStatusMessage(message(cause, 'Impossible de créer le paiement.'));
      setBusyPriceId(null);
      await loadOrders();
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des paiements…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <small style={{ color: 'var(--mint)' }}>KMD-033 · PAIEMENTS CLIENTS</small>
        <h1 style={{ marginBottom: 8 }}>Achats et abonnements KnowMe</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
          Les prix, produits, statuts et attributions sont décidés par le serveur. Le navigateur
          ne transmet jamais un montant libre et aucun achat n’est livré avant vérification du fournisseur.
        </p>
      </header>

      {statusMessage ? (
        <p role="status" className="card" style={{ padding: 14, color: 'var(--orange)' }}>
          {statusMessage}
        </p>
      ) : null}

      <section className="card" style={{ padding: 22, marginBottom: 22 }}>
        <h2 style={{ marginTop: 0 }}>Zone de facturation</h2>
        <form
          onSubmit={refreshCatalog}
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
        >
          <label>
            <span>Pays ISO</span>
            <input
              className="input"
              value={country}
              onChange={(event) => setCountry(countryCode(event.target.value))}
              placeholder="BJ"
              maxLength={2}
            />
          </label>
          <label>
            <span>Devise, facultatif</span>
            <input
              className="input"
              value={currency}
              onChange={(event) => setCurrency(currencyCode(event.target.value))}
              placeholder="XOF, EUR, USD…"
              maxLength={3}
            />
          </label>
          <label>
            <span>Téléphone, facultatif</span>
            <input
              className="input"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+229…"
              maxLength={32}
            />
          </label>
          <label>
            <span>Ville, facultatif</span>
            <input
              className="input"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={80}
            />
          </label>
          <label>
            <span>Adresse, facultatif</span>
            <input
              className="input"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            <span>État / région</span>
            <input
              className="input"
              value={state}
              onChange={(event) => setState(event.target.value)}
              maxLength={40}
            />
          </label>
          <label>
            <span>Code postal</span>
            <input
              className="input"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              maxLength={12}
            />
          </label>
          <button className="btn" disabled={catalogLoading}>
            {catalogLoading ? 'Actualisation…' : 'Actualiser les tarifs'}
          </button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 0 }}>
          Fournisseurs Web actifs : {configuredWebProviders.length
            ? configuredWebProviders.join(', ')
            : 'aucun fournisseur complètement configuré'}.
        </p>
      </section>

      <section>
        <h2>Catalogue disponible</h2>
        {catalogLoading ? (
          <p>Chargement du catalogue…</p>
        ) : catalog.length === 0 ? (
          <div className="card" style={{ padding: 22 }}>
            Aucun tarif actif ne correspond à ce pays et à cette devise.
          </div>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))' }}
          >
            {catalog.map((product) => (
              <article
                key={product.key}
                className="card"
                style={{
                  padding: 22,
                  display: 'grid',
                  gap: 16,
                  borderColor: product.highlighted ? 'var(--mint)' : undefined
                }}
              >
                <div>
                  <small style={{ color: product.highlighted ? 'var(--mint)' : 'var(--muted)' }}>
                    {product.highlighted ? 'OFFRE MISE EN AVANT' : product.kind}
                  </small>
                  <h2 style={{ margin: '6px 0 8px' }}>{product.name}</h2>
                  <p style={{ color: 'var(--muted)', margin: 0 }}>
                    {product.description ?? 'Produit délivré après vérification serveur.'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {product.requiresVerification ? (
                    <span style={pillStyle}>Identité vérifiée requise</span>
                  ) : null}
                  {product.requiresManualReview ? (
                    <span style={pillStyle}>Revue manuelle possible</span>
                  ) : null}
                  <span style={pillStyle}>Prix autoritaire côté serveur</span>
                </div>
                <div className="grid" style={{ gap: 10 }}>
                  {product.prices.map((price) => {
                    if (price.provider !== 'FLUTTERWAVE' && price.provider !== 'CINETPAY') {
                      return null;
                    }
                    const provider = price.provider;
                    const configured = Boolean(providers?.providers[provider].configured);
                    return (
                      <div
                        key={price.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14,
                          flexWrap: 'wrap',
                          padding: 14,
                          borderRadius: 16,
                          background: 'var(--surface-2)'
                        }}
                      >
                        <div>
                          <strong>{formatMinorAmount(price.unitAmount, price.currency)}</strong>
                          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                            {providerLabel(provider)}
                            {price.countryCode ? ` · ${price.countryCode}` : ' · tarif global'}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary"
                          disabled={!configured || busyPriceId !== null}
                          onClick={() => void checkout(product, price)}
                        >
                          {busyPriceId === price.id
                            ? 'Création…'
                            : configured
                              ? `Payer avec ${providerLabel(provider)}`
                              : `${providerLabel(provider)} indisponible`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <h2>Mes commandes</h2>
          <button className="btn" onClick={() => void loadOrders()} disabled={ordersLoading}>
            {ordersLoading ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        {ordersLoading ? (
          <p>Chargement de l’historique…</p>
        ) : orders.length === 0 ? (
          <div className="card" style={{ padding: 22 }}>
            Aucun paiement n’a encore été créé sur ce compte.
          </div>
        ) : (
          <div className="grid">
            {orders.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        )}
      </section>
    </main>
  );
}
