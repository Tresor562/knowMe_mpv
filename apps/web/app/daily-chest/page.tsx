'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type DailyChestState = {
  claimDate: string;
  expiresAt: string;
  eligible: boolean;
  claimed: boolean;
  canClaim: boolean;
  currentBalance: number;
  quest: { status: string; completedAt?: string | null } | null;
  claim: { id: string; amount: number; claimedAt: string } | null;
  rules: {
    amount: number;
    currency: string;
    deterministic: boolean;
    randomReward: boolean;
    purchaseRequired: boolean;
    premiumBoostAllowed: boolean;
    streakPenalty: boolean;
    oneClaimPerUtcDay: boolean;
  };
};

type ClaimResponse = {
  replayed: boolean;
  state: DailyChestState;
};

export default function DailyChestPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [state, setState] = useState<DailyChestState | null>(null);
  const [message, setMessage] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await apiFetch<DailyChestState>('/daily-chest/today'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Coffre indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function claim() {
    setClaiming(true);
    try {
      const response = await apiFetch<ClaimResponse>('/daily-chest/claim', {
        method: 'POST'
      });
      setState(response.state);
      setMessage(
        response.replayed
          ? 'Ce coffre avait déjà été ouvert.'
          : `${response.state.rules.amount} KnowCoins ont été ajoutés à ton portefeuille.`
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Ouverture impossible.');
    } finally {
      setClaiming(false);
    }
  }

  if (sessionLoading || !user || !state) {
    return (
      <main className="shell">
        <p>{message || 'Chargement du coffre quotidien…'}</p>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 820, margin: '0 auto' }}>
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
          <small style={{ color: 'var(--mint)' }}>COFFRE QUOTIDIEN</small>
          <h1>Une récompense fixe, sans hasard</h1>
          <p style={{ color: 'var(--muted)' }}>
            Termine la quête du jour, puis ouvre une fois le coffre avant{' '}
            {new Date(state.expiresAt).toLocaleString('fr-FR')}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/quests" className="btn">
            Quête du jour
          </Link>
          <Link href="/wallet" className="btn btn-primary">
            Portefeuille
          </Link>
        </div>
      </header>

      {message && <p role="status">{message}</p>}

      <section
        className="card"
        style={{ padding: 28, marginTop: 24, textAlign: 'center' }}
      >
        <div style={{ fontSize: 72 }}>{state.claimed ? '✅' : state.eligible ? '🎁' : '🔒'}</div>
        <h2>
          {state.claimed
            ? 'Coffre déjà ouvert'
            : state.eligible
              ? 'Coffre déverrouillé'
              : 'Termine d’abord la quête quotidienne'}
        </h2>
        <div style={{ fontSize: 42, fontWeight: 900 }}>
          +{state.rules.amount} KnowCoins
        </div>
        <p style={{ color: 'var(--muted)' }}>
          Solde actuel : {state.currentBalance} KnowCoins
        </p>
        {state.canClaim && (
          <button className="btn btn-primary" disabled={claiming} onClick={() => void claim()}>
            {claiming ? 'Ouverture…' : 'Ouvrir le coffre'}
          </button>
        )}
      </section>

      <section className="card" style={{ padding: 20, marginTop: 24 }}>
        <h2>Règles transparentes</h2>
        <p style={{ color: 'var(--muted)' }}>
          Le montant est toujours identique. Il n’existe aucune rareté, roulette, lot aléatoire,
          achat obligatoire ou bonus Premium. Manquer un jour ne retire rien et ne casse aucune
          série. Les doubles clics et requêtes concurrentes rejouent la même écriture comptable.
        </p>
      </section>
    </main>
  );
}
