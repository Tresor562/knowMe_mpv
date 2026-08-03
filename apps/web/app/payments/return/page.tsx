'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  getPaymentOrder,
  PaymentOrder,
  paymentStatusLabel,
  paymentStatusTone,
  resolvePaymentOrderReference,
  verifyWebPayment
} from '../../../lib/payments';
import { useSession } from '../../../lib/use-session';

const LAST_PAYMENT_ORDER_KEY = 'knowme:last-payment-order';
const LAST_PAYMENT_REFERENCE_KEY = 'knowme:last-payment-reference';

function pickTransactionId(query: URLSearchParams) {
  const keys = [
    'transaction_id',
    'transactionId',
    'transaction-id',
    'cpm_trans_id',
    'payment_id',
    'id'
  ];
  for (const key of keys) {
    const value = query.get(key)?.trim();
    if (value && value.length >= 3) return value;
  }
  return '';
}

function pickDirectOrderId(query: URLSearchParams) {
  return (
    query.get('orderId')?.trim() ||
    query.get('order_id')?.trim() ||
    window.sessionStorage.getItem(LAST_PAYMENT_ORDER_KEY) ||
    ''
  );
}

function pickReference(query: URLSearchParams) {
  const keys = ['tx_ref', 'cpm_trans_id', 'reference', 'payment_reference'];
  for (const key of keys) {
    const value = query.get(key)?.trim();
    if (value?.toUpperCase().startsWith('KM-')) return value.toUpperCase();
  }
  return window.sessionStorage.getItem(LAST_PAYMENT_REFERENCE_KEY)?.trim().toUpperCase() || '';
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function PaymentReturnPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('Retour du fournisseur reçu.');

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadReturnedOrder() {
      const query = new URLSearchParams(window.location.search);
      const returnedTransactionId = pickTransactionId(query);
      let resolvedOrderId = pickDirectOrderId(query);
      const reference = pickReference(query);

      if (active) setTransactionId(returnedTransactionId);

      try {
        if (!resolvedOrderId && reference) {
          const resolved = await resolvePaymentOrderReference(reference);
          resolvedOrderId = resolved.id;
        }

        if (!resolvedOrderId) {
          if (active) {
            setMessage(
              'Aucune commande liée à ce retour n’a été retrouvée. Ouvre ton historique de paiements pour sélectionner la commande.'
            );
          }
          return;
        }

        const value = await getPaymentOrder(resolvedOrderId);
        if (!active) return;
        setOrderId(resolvedOrderId);
        setOrder(value);
        setMessage(
          value.fulfilledAt
            ? 'Cette commande est déjà vérifiée et livrée.'
            : 'La commande a été retrouvée. Lance la vérification serveur pour confirmer le résultat.'
        );
      } catch (cause) {
        if (active) setMessage(errorMessage(cause, 'Commande introuvable.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReturnedOrder();
    return () => {
      active = false;
    };
  }, [user]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderId || transactionId.trim().length < 3 || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyWebPayment(orderId, transactionId);
      setOrder(result.order);
      setMessage(
        result.order.fulfilledAt
          ? 'Paiement vérifié : l’attribution a été exécutée par le serveur.'
          : `Vérification terminée : ${paymentStatusLabel(result.order.status)}.`
      );
      window.sessionStorage.removeItem(LAST_PAYMENT_ORDER_KEY);
      window.sessionStorage.removeItem(LAST_PAYMENT_REFERENCE_KEY);
    } catch (cause) {
      setMessage(errorMessage(cause, 'La vérification du fournisseur a échoué.'));
    } finally {
      setVerifying(false);
    }
  }

  if (sessionLoading || loading || !user) {
    return <main className="shell"><p>Vérification du retour de paiement…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card" style={{ padding: 28, display: 'grid', gap: 18 }}>
        <small style={{ color: 'var(--mint)' }}>RETOUR DE PAIEMENT</small>
        <h1 style={{ margin: 0 }}>Confirmer avec le fournisseur</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Le retour navigateur n’est jamais une preuve de paiement. KnowMe interroge le fournisseur,
          compare la référence, le montant et la devise, puis délivre le produit côté serveur.
        </p>

        {order ? (
          <div className="card" style={{ padding: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>{order.productName}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{order.reference}</div>
              </div>
              <strong style={{ color: paymentStatusTone(order.status) }}>
                {paymentStatusLabel(order.status)}
              </strong>
            </div>
          </div>
        ) : null}

        <p role="status" style={{ color: order?.fulfilledAt ? 'var(--mint)' : 'var(--orange)' }}>
          {message}
        </p>

        {order &&
        !order.fulfilledAt &&
        ['FLUTTERWAVE', 'CINETPAY'].includes(order.provider) ? (
          <form className="grid" onSubmit={verify}>
            <label htmlFor="transaction-id">Identifiant de transaction fournisseur</label>
            <input
              id="transaction-id"
              className="input"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              placeholder="Identifiant retourné par le fournisseur"
              minLength={3}
              maxLength={500}
              required
            />
            <button
              className="btn btn-primary"
              disabled={verifying || transactionId.trim().length < 3}
            >
              {verifying ? 'Vérification serveur…' : 'Vérifier maintenant'}
            </button>
          </form>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {order ? (
            <Link className="btn" href={`/payments/orders/${order.id}`}>
              Détails de la commande
            </Link>
          ) : null}
          <Link className="btn" href="/payments">Historique des paiements</Link>
        </div>
      </section>
    </main>
  );
}
