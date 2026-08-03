'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  getPaymentOrder,
  PaymentOrder,
  paymentStatusLabel,
  paymentStatusTone,
  verifyWebPayment
} from '../../../lib/payments';
import { useSession } from '../../../lib/use-session';

const LAST_PAYMENT_ORDER_KEY = 'knowme:last-payment-order';

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

function pickOrderId(query: URLSearchParams) {
  return (
    query.get('orderId')?.trim() ||
    query.get('order_id')?.trim() ||
    window.sessionStorage.getItem(LAST_PAYMENT_ORDER_KEY) ||
    ''
  );
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
    const query = new URLSearchParams(window.location.search);
    const resolvedOrderId = pickOrderId(query);
    const resolvedTransactionId = pickTransactionId(query);
    setOrderId(resolvedOrderId);
    setTransactionId(resolvedTransactionId);

    if (!resolvedOrderId) {
      setMessage(
        'Aucune commande locale n’a été retrouvée. Ouvre ton historique de paiements pour sélectionner la commande.'
      );
      setLoading(false);
      return;
    }

    getPaymentOrder(resolvedOrderId)
      .then((value) => {
        setOrder(value);
        setMessage(
          value.fulfilledAt
            ? 'Cette commande est déjà vérifiée et livrée.'
            : 'La commande a été retrouvée. Lance la vérification serveur pour confirmer le résultat.'
        );
      })
      .catch((cause) => setMessage(errorMessage(cause, 'Commande introuvable.')))
      .finally(() => setLoading(false));
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
      window.sessionStorage.removeItem('knowme:last-payment-reference');
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

        {order && (
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
        )}

        <p role="status" style={{ color: order?.fulfilledAt ? 'var(--mint)' : 'var(--orange)' }}>
          {message}
        </p>

        {order && !order.fulfilledAt && ['FLUTTERWAVE', 'CINETPAY'].includes(order.provider) && (
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
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {order && (
            <Link className="btn" href={`/payments/orders/${order.id}`}>
              Détails de la commande
            </Link>
          )}
          <Link className="btn" href="/payments">Historique des paiements</Link>
        </div>
      </section>
    </main>
  );
}
