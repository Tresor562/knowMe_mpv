'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Price = {
  id: string;
  provider: string;
  externalPriceId?: string | null;
  platform: string;
  countryCode?: string | null;
  currency: string;
  unitAmount: number;
  interval: string;
  intervalCount: number;
  active: boolean;
};
type Plan = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  active: boolean;
  highlighted: boolean;
  requiresVerification: boolean;
  requiresManualReview: boolean;
  prices: Price[];
  entitlements: Array<{ key: string }>;
  _count: { subscriptions: number };
};
type Subscription = {
  id: string;
  status: string;
  provider: string;
  externalSubscriptionId: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  user: { id: string; displayName: string; username: string; email: string };
  plan: { name: string; key: string };
};
type BillingEvent = {
  id: string;
  provider: string;
  externalEventId: string;
  type: string;
  status: string;
  reason?: string | null;
  receivedAt: string;
};

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function BillingPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [planItems, subscriptionItems, eventItems] = await Promise.all([
        apiFetch<Plan[]>('/admin/billing/plans'),
        apiFetch<Subscription[]>('/admin/billing/subscriptions'),
        apiFetch<BillingEvent[]>('/admin/billing/events')
      ]);
      setPlans(planItems);
      setSubscriptions(subscriptionItems);
      setEvents(eventItems);
      setMessage('');
    } catch (cause) {
      setMessage(errorMessage(cause, 'Chargement de la facturation impossible.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const entitlements = String(form.get('entitlements') ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    setBusy(true);
    try {
      await apiFetch('/admin/billing/plans', {
        method: 'POST',
        body: JSON.stringify({
          key: String(form.get('key') ?? '').trim().toLowerCase(),
          name: String(form.get('name') ?? '').trim(),
          description: String(form.get('description') ?? '').trim(),
          active: false,
          entitlements
        })
      });
      event.currentTarget.reset();
      setMessage('Plan créé désactivé. Ajoute ses prix puis active-le après validation.');
      await load();
    } catch (cause) {
      setMessage(errorMessage(cause, 'Création du plan impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function togglePlan(plan: Plan) {
    setBusy(true);
    try {
      await apiFetch(`/admin/billing/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          active: !plan.active,
          reason: plan.active
            ? 'Désactivation depuis le centre de facturation.'
            : 'Activation depuis le centre de facturation.'
        })
      });
      await load();
    } catch (cause) {
      setMessage(errorMessage(cause, 'Modification du plan impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function addPrice(event: FormEvent<HTMLFormElement>, planId: string) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiFetch(`/admin/billing/plans/${planId}/prices`, {
        method: 'POST',
        body: JSON.stringify({
          provider: String(form.get('provider') ?? '').trim().toUpperCase(),
          externalPriceId: String(form.get('externalPriceId') ?? '').trim() || undefined,
          platform: String(form.get('platform') ?? 'ALL'),
          countryCode: String(form.get('countryCode') ?? '').trim().toUpperCase() || undefined,
          currency: String(form.get('currency') ?? '').trim().toUpperCase(),
          unitAmount: Number(form.get('unitAmount')),
          interval: 'MONTH',
          intervalCount: 1
        })
      });
      event.currentTarget.reset();
      setMessage('Prix ajouté au catalogue.');
      await load();
    } catch (cause) {
      setMessage(errorMessage(cause, 'Ajout du prix impossible.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--orange)' }}>FACTURATION AUTORITAIRE</small>
          <h2>Plans, prix et abonnements</h2>
        </div>
        <button className="btn" onClick={() => void load()} disabled={busy}>Actualiser</button>
      </div>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <form className="card grid" onSubmit={createPlan} style={{ padding: 22, marginBottom: 22 }}>
        <h3>Créer un plan désactivé</h3>
        <input className="input" name="key" placeholder="creator_monthly" pattern="[a-z0-9._-]{3,64}" required />
        <input className="input" name="name" placeholder="Nom du plan" minLength={2} maxLength={100} required />
        <textarea className="input" name="description" placeholder="Description" rows={3} maxLength={1000} />
        <input className="input" name="entitlements" placeholder="premium.core, creator.tools" required />
        <button className="btn btn-primary" disabled={busy}>Créer le plan</button>
      </form>

      <div className="grid">
        {plans.map((plan) => (
          <article className="card" key={plan.id} style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 20 }}>{plan.name}</strong>
                <div style={{ color: 'var(--muted)' }}>{plan.key}</div>
              </div>
              <button className="btn" disabled={busy} onClick={() => void togglePlan(plan)}>
                {plan.active ? 'Désactiver' : 'Activer'}
              </button>
            </div>
            <p>{plan.description}</p>
            <p style={{ color: 'var(--muted)' }}>
              {plan._count.subscriptions} abonnement(s) · {plan.active ? 'actif' : 'désactivé'}
              {plan.requiresVerification ? ' · identité requise' : ''}
              {plan.requiresManualReview ? ' · examen manuel' : ''}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {plan.entitlements.map((item) => (
                <code key={item.key} style={{ background: 'var(--surface-2)', padding: '6px 9px', borderRadius: 8 }}>{item.key}</code>
              ))}
            </div>
            <h4>Prix</h4>
            {plan.prices.map((price) => (
              <p key={price.id} style={{ color: 'var(--muted)' }}>
                {price.provider} · {price.platform} · {price.countryCode ?? 'global'} · {(price.unitAmount / 100).toFixed(2)} {price.currency}/{price.interval.toLowerCase()}
              </p>
            ))}
            <form className="grid" onSubmit={(event) => void addPrice(event, plan.id)}>
              <input className="input" name="provider" placeholder="Prestataire, ex. TEST" required />
              <input className="input" name="externalPriceId" placeholder="Identifiant externe facultatif" />
              <select className="input" name="platform" defaultValue="ALL">
                <option value="ALL">Toutes les plateformes</option>
                <option value="WEB">Web</option>
                <option value="ANDROID">Android</option>
                <option value="IOS">iOS</option>
              </select>
              <input className="input" name="countryCode" placeholder="Pays ISO facultatif, ex. BJ" maxLength={2} />
              <input className="input" name="currency" placeholder="USD" defaultValue="USD" maxLength={3} required />
              <input className="input" name="unitAmount" type="number" min={0} step={1} placeholder="Montant en centimes" required />
              <button className="btn" disabled={busy}>Ajouter le prix</button>
            </form>
          </article>
        ))}
      </div>

      <h3 style={{ marginTop: 28 }}>Abonnements récents</h3>
      <div className="grid">
        {subscriptions.slice(0, 20).map((subscription) => (
          <article className="card" key={subscription.id} style={{ padding: 18 }}>
            <strong>{subscription.user.displayName} · {subscription.plan.name}</strong>
            <p style={{ color: 'var(--muted)' }}>@{subscription.user.username} · {subscription.provider} · {subscription.status}</p>
            <p>Échéance : {new Date(subscription.currentPeriodEnd).toLocaleString('fr-FR')}</p>
            {subscription.cancelAtPeriodEnd && <p style={{ color: 'var(--orange)' }}>Annulation prévue en fin de période.</p>}
          </article>
        ))}
        {!subscriptions.length && <article className="card" style={{ padding: 18, color: 'var(--muted)' }}>Aucun abonnement vérifié.</article>}
      </div>

      <h3 style={{ marginTop: 28 }}>Événements prestataires</h3>
      <div className="grid">
        {events.slice(0, 20).map((event) => (
          <article className="card" key={event.id} style={{ padding: 18 }}>
            <strong>{event.provider} · {event.type}</strong>
            <p style={{ color: 'var(--muted)' }}>{event.externalEventId}</p>
            <p>{event.status}{event.reason ? ` · ${event.reason}` : ''} · {new Date(event.receivedAt).toLocaleString('fr-FR')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
