'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../../lib/use-session';
import {
  formatMinorAmount,
  getPaymentOrder,
  PaymentOrder,
  paymentStatusLabel,
  paymentStatusTone,
  verifyWebPayment
} from '../../../../lib/payments';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function PaymentOrderPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [externalTransactionId, setExternalTransactionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const load = useCallback(async () => {
    if (!user || !params.id) return;
    setLoading(true);
    try {
      setOrder(await getPaymentOrder(params.id));
      setStatusMessage('');
    } catch (cause) {
      setStatusMessage(message(cause, 'Commande introuvable.'));
    } finally {
      setLoading(false);
    }
  }, [params.id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || externalTransactionId.trim().length < 3 || verifying) return;
    setVerifying(true);
    setStatusMessage('');
    try {
      const result = await verifyWebPayment(order.id, externalTransactionId);
      setOrder(result.order);
      setStatusMessage(
        result.order.fulfilledAt
          ? 'Paiement vérifié et produit délivré.'
          : 'Vérification terminée. Le statut serveur a été actualisé.'
      );
    } catch (cause) {
      setStatusMessage(message(cause, 'Vérification impossible.'));
    } finally {
      setVerifying(false);
    }
  }

  if (sessionLoading || loading || !user) {
    return <main className="shell"><p>Chargement de la commande…</p></main>;
  }

  if (!order) {
    return (
      <main className="shell" style={{ maxWidth: 780, margin: '0 auto' }}>
        <p role="status">{statusMessage || 'Commande introuvable.'}</p>
        <Link className="btn" href="/payments">Retour aux paiements</Link>
      </main>
    );
  }

  const canVerify =
    ['FLUTTERWAVE', 'CINETPAY'].includes(order.provider) &&
    !['FULFILLED', 'REFUNDED', 'CANCELED'].includes(order.status);

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/payments" style={{ color: 'var(--mint)' }}>← Paiements</Link>
      <section className="card" style={{ padding: 28, marginTop: 18, display: 'grid', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <small style={{ color: 'var(--muted)' }}>{order.reference}</small>
            <h1 style={{ margin: '6px 0' }}>{order.productName}</h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              {order.provider} · {order.platform}
            </p>
          </div>
          <strong style={{ color: paymentStatusTone(order.status), fontSize: 18 }}>
            {paymentStatusLabel(order.status)}
          </strong>
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
        >
          <article className="card" style={{ padding: 16 }}>
            <small style={{ color: 'var(--muted)' }}>Montant attendu</small>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {formatMinorAmount(order.expectedAmount, order.currency)}
            </div>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <small style={{ color: 'var(--muted)' }}>Créée le</small>
            <div>{new Date(order.createdAt).toLocaleString('fr-FR')}</div>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <small style={{ color: 'var(--muted)' }}>Expiration</small>
            <div>{new Date(order.expiresAt).toLocaleString('fr-FR')}</div>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <small style={{ color: 'var(--muted)' }}>Livraison</small>
            <div>
              {order.fulfilledAt
                ? new Date(order.fulfilledAt).toLocaleString('fr-FR')
                : 'En attente de validation'}
            </div>
          </article>
        </div>

        {statusMessage && (
          <p role="status" style={{ color: order.fulfilledAt ? 'var(--mint)' : 'var(--orange)' }}>
            {statusMessage}
          </p>
        )}

        {canVerify && (
          <form onSubmit={verify} className="grid">
            <h2 style={{ marginBottom: 0 }}>Vérifier auprès du fournisseur</h2>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              La référence externe sert uniquement à demander une vérification directe au fournisseur.
              Le navigateur ne peut pas déclarer lui-même le paiement comme réussi.
            </p>
            <input
              className="input"
              value={externalTransactionId}
              onChange={(event) => setExternalTransactionId(event.target.value)}
              placeholder="Identifiant de transaction Flutterwave ou CinetPay"
              minLength={3}
              maxLength={500}
              required
            />
            <button
              className="btn btn-primary"
              disabled={verifying || externalTransactionId.trim().length < 3}
            >
              {verifying ? 'Vérification…' : 'Vérifier le paiement'}
            </button>
          </form>
        )}

        {order.checkoutUrl && ['CREATED', 'PENDING'].includes(order.status) && (
          <a className="btn" href={order.checkoutUrl} rel="noreferrer">
            Reprendre le paiement sécurisé
          </a>
        )}

        {order.invoice && (
          <section>
            <h2>Facture</h2>
            <div className="card" style={{ padding: 16 }}>
              <strong>{order.invoice.number}</strong>
              <p style={{ color: 'var(--muted)' }}>
                {order.invoice.status} · {formatMinorAmount(order.invoice.total, order.invoice.currency)}
              </p>
            </div>
          </section>
        )}

        <section>
          <h2>Tentatives de vérification</h2>
          {order.attempts?.length ? (
            <div className="grid">
              {order.attempts.map((attempt) => (
                <div key={attempt.id} className="card" style={{ padding: 14 }}>
                  <strong>{attempt.status}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {attempt.rawStatus ?? 'Statut fournisseur non communiqué'} ·{' '}
                    {new Date(attempt.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Aucune tentative enregistrée.</p>
          )}
        </section>

        <section>
          <h2>Remboursements</h2>
          {order.refunds?.length ? (
            <div className="grid">
              {order.refunds.map((refund) => (
                <div key={refund.id} className="card" style={{ padding: 14 }}>
                  <strong>{formatMinorAmount(refund.amount, refund.currency)}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {refund.status} · {new Date(refund.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Aucun remboursement enregistré.</p>
          )}
        </section>
      </section>
    </main>
  );
}
