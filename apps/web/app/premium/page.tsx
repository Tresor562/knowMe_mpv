'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Price = {
  id: string;
  provider: string;
  platform: string;
  countryCode?: string | null;
  currency: string;
  unitAmount: number;
  interval: string;
  intervalCount: number;
};
type Plan = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  highlighted: boolean;
  requiresVerification: boolean;
  requiresManualReview: boolean;
  entitlements: string[];
  prices: Price[];
  checkoutAvailable: boolean;
};
type Subscription = {
  id: string;
  status: string;
  provider: string;
  externalSubscriptionId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  endedAt?: string | null;
  grantsAccess: boolean;
  entitlementKeys: string[];
  plan: { name: string; key: string };
  price?: Price | null;
};
type BillingState = {
  accountId: string;
  serverTime: string;
  subscriptions: Subscription[];
  entitlements: Array<{
    id: string;
    key: string;
    source: string;
    startsAt: string;
    expiresAt?: string | null;
  }>;
};

function priceLabel(price: Price) {
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: price.currency
  }).format(price.unitAmount / 100);
  return `${amount} / ${price.intervalCount > 1 ? `${price.intervalCount} ` : ''}${price.interval.toLowerCase()}`;
}

export default function PremiumPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [state, setState] = useState<BillingState | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [catalog, billingState] = await Promise.all([
        apiFetch<Plan[]>('/billing/plans?platform=WEB'),
        apiFetch<BillingState>('/billing/me')
      ]);
      setPlans(catalog);
      setState(billingState);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Facturation indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  if (sessionLoading || loading) {
    return <main className="shell"><p>Chargement de Premium…</p></main>;
  }

  const activeSubscriptions = state?.subscriptions.filter((item) => item.grantsAccess) ?? [];

  return (
    <main className="shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: '#f4c95d' }}>KNOWME PREMIUM</small>
          <h1>Ton abonnement, vérifié par le serveur</h1>
          <p style={{ color: 'var(--muted)' }}>
            Le statut affiché ici vient de PostgreSQL et des événements de paiement signés,
            jamais du navigateur ou de l’application installée.
          </p>
        </div>
        <Link className="btn" href="/profile">Retour au profil</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        {plans.map((plan) => (
          <article className="card" key={plan.id} style={{ padding: 24, borderColor: plan.highlighted ? '#f4c95d' : undefined }}>
            <small style={{ color: plan.highlighted ? '#f4c95d' : 'var(--mint)' }}>
              {plan.highlighted ? 'RECOMMANDÉ' : 'PLAN KNOWME'}
            </small>
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            {plan.prices.map((price) => (
              <strong key={price.id} style={{ display: 'block', fontSize: 24, marginBottom: 10 }}>
                {priceLabel(price)}
              </strong>
            ))}
            <ul style={{ lineHeight: 1.8 }}>
              {plan.entitlements.map((key) => <li key={key}>{key}</li>)}
            </ul>
            {plan.requiresVerification && <p>Une vérification d’identité est obligatoire.</p>}
            {plan.requiresManualReview && <p>Un examen par l’équipe KnowMe est obligatoire.</p>}
            <button className="btn btn-primary" disabled={!plan.checkoutAvailable}>
              {plan.checkoutAvailable ? 'Choisir ce plan' : 'Paiement bientôt disponible'}
            </button>
            {!plan.checkoutAvailable && (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                Aucun paiement n’est collecté tant qu’un prestataire officiel et son adaptateur
                de vérification ne sont pas activés.
              </p>
            )}
          </article>
        ))}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Mes abonnements</h2>
        <div className="grid">
          {state?.subscriptions.map((subscription) => (
            <article className="card" key={subscription.id} style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{subscription.plan.name}</strong>
                <span style={{ color: subscription.grantsAccess ? 'var(--mint)' : 'var(--orange)' }}>
                  {subscription.status}
                </span>
              </div>
              <p style={{ color: 'var(--muted)' }}>
                Prestataire : {subscription.provider} · échéance serveur :{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleString('fr-FR')}
              </p>
              {subscription.cancelAtPeriodEnd && (
                <p style={{ color: 'var(--orange)' }}>
                  Annulation programmée : les droits restent actifs jusqu’à l’échéance.
                </p>
              )}
              <p>{subscription.grantsAccess ? 'Accès Premium actif.' : 'Aucun accès Premium actif.'}</p>
            </article>
          ))}
          {!state?.subscriptions.length && (
            <article className="card" style={{ padding: 22, color: 'var(--muted)' }}>
              Aucun abonnement vérifié pour ce compte.
            </article>
          )}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Droits actifs</h2>
        <p style={{ color: 'var(--muted)' }}>
          {activeSubscriptions.length} abonnement(s) donnant actuellement accès.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state?.entitlements.map((item) => (
            <code key={item.id} style={{ background: 'var(--surface-2)', padding: '8px 11px', borderRadius: 9 }}>
              {item.key}
            </code>
          ))}
          {!state?.entitlements.length && <span style={{ color: 'var(--muted)' }}>Aucun droit exclusif actif.</span>}
        </div>
      </section>
    </main>
  );
}
