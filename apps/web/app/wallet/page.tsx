'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Wallet = {
  accountId: string;
  balance: number;
  version: number;
  updatedAt: string;
  serverTime: string;
};

type LedgerEntry = {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: string;
  source: string;
  reason?: string | null;
  createdAt: string;
};

type RewardEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  status: 'AWARDED' | 'REJECTED' | 'IGNORED';
  amount: number;
  reasonCode?: string | null;
  explanation?: string | null;
  createdAt: string;
  policy: {
    key: string;
    version: number;
    eventType: string;
    amount: number;
  };
};

type Page<T> = { items: T[]; nextCursor: string | null };

export default function WalletPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [rewards, setRewards] = useState<RewardEvent[]>([]);
  const [ledgerCursor, setLedgerCursor] = useState<string | null>(null);
  const [rewardCursor, setRewardCursor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [walletResult, ledgerResult, rewardResult] = await Promise.all([
        apiFetch<Wallet>('/wallet/me'),
        apiFetch<Page<LedgerEntry>>('/wallet/history?limit=30'),
        apiFetch<Page<RewardEvent>>('/rewards/me?limit=30')
      ]);
      setWallet(walletResult);
      setLedger(ledgerResult.items);
      setLedgerCursor(ledgerResult.nextCursor);
      setRewards(rewardResult.items);
      setRewardCursor(rewardResult.nextCursor);
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger le portefeuille.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function loadMoreLedger() {
    if (!ledgerCursor) return;
    const result = await apiFetch<Page<LedgerEntry>>(
      `/wallet/history?limit=30&cursor=${encodeURIComponent(ledgerCursor)}`
    );
    setLedger((current) => [...current, ...result.items]);
    setLedgerCursor(result.nextCursor);
  }

  async function loadMoreRewards() {
    if (!rewardCursor) return;
    const result = await apiFetch<Page<RewardEvent>>(
      `/rewards/me?limit=30&cursor=${encodeURIComponent(rewardCursor)}`
    );
    setRewards((current) => [...current, ...result.items]);
    setRewardCursor(result.nextCursor);
  }

  if (sessionLoading || loading) {
    return <main className="shell"><p>Chargement de tes KnowCoins…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 960, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: '#f4c95d' }}>PORTEFEUILLE KNOWME</small>
          <h1>Mes KnowCoins</h1>
          <p style={{ color: 'var(--muted)' }}>
            Solde vérifié par le serveur pour {user?.displayName}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void load()}>Actualiser</button>
          <Link href="/challenges" className="btn">Voir les défis</Link>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section
        className="card"
        style={{
          padding: 28,
          marginBottom: 24,
          borderColor: '#f4c95d',
          background: 'linear-gradient(135deg, rgba(244,201,93,.1), var(--surface))'
        }}
      >
        <div style={{ color: 'var(--muted)' }}>Solde disponible</div>
        <strong style={{ fontSize: 52 }}>{wallet?.balance ?? 0}</strong>
        <div style={{ color: '#f4c95d', fontWeight: 800 }}>KnowCoins</div>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Version comptable {wallet?.version ?? 0} · synchronisé le{' '}
          {wallet ? new Date(wallet.updatedAt).toLocaleString('fr-FR') : '—'}
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Récompenses évaluées</h2>
        <p style={{ color: 'var(--muted)' }}>
          Chaque résultat explique pourquoi une récompense a été attribuée, ignorée ou refusée.
        </p>
        <div className="grid">
          {rewards.map((event) => (
            <article className="card" key={event.id} style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <strong>{event.eventType}</strong>
                <span
                  style={{
                    color:
                      event.status === 'AWARDED'
                        ? 'var(--mint)'
                        : event.status === 'REJECTED'
                          ? 'var(--orange)'
                          : 'var(--muted)',
                    fontWeight: 900
                  }}
                >
                  {event.status}
                </span>
              </div>
              <p style={{ fontSize: 22, marginBottom: 4 }}>
                {event.amount > 0 ? `+${event.amount} KnowCoins` : 'Aucun crédit'}
              </p>
              <p>{event.explanation ?? event.reasonCode ?? 'Évaluation terminée.'}</p>
              <small style={{ color: 'var(--muted)' }}>
                Politique {event.policy.key} v{event.policy.version} ·{' '}
                {new Date(event.createdAt).toLocaleString('fr-FR')}
              </small>
            </article>
          ))}
          {!rewards.length && (
            <article className="card" style={{ padding: 20 }}>
              Aucune récompense évaluée pour le moment.
            </article>
          )}
        </div>
        {rewardCursor && (
          <button className="btn" onClick={() => void loadMoreRewards()} style={{ marginTop: 14 }}>
            Charger plus de récompenses
          </button>
        )}
      </section>

      <section>
        <h2>Registre comptable</h2>
        <div className="grid">
          {ledger.map((entry) => (
            <article className="card" key={entry.id} style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <strong
                  style={{ color: entry.amount > 0 ? 'var(--mint)' : 'var(--orange)' }}
                >
                  {entry.amount > 0 ? '+' : ''}{entry.amount} KnowCoins
                </strong>
                <small>{new Date(entry.createdAt).toLocaleString('fr-FR')}</small>
              </div>
              <p>
                Solde : {entry.balanceBefore} → <strong>{entry.balanceAfter}</strong>
              </p>
              <p style={{ color: 'var(--muted)' }}>{entry.type} · {entry.source}</p>
              {entry.reason && <p>{entry.reason}</p>}
            </article>
          ))}
          {!ledger.length && (
            <article className="card" style={{ padding: 20 }}>
              Aucun mouvement comptable.
            </article>
          )}
        </div>
        {ledgerCursor && (
          <button className="btn" onClick={() => void loadMoreLedger()} style={{ marginTop: 14 }}>
            Charger la suite du registre
          </button>
        )}
      </section>
    </main>
  );
}
