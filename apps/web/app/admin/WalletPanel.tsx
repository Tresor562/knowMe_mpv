'use client';

import { FormEvent, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Wallet = {
  userId: string;
  balance: number;
  version: number;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
};

type LedgerEntry = {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: string;
  source: string;
  idempotencyKey: string;
  referenceType: string | null;
  referenceId: string | null;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
};

type History = {
  items: LedgerEntry[];
  nextCursor: string | null;
};

type AdjustmentResult = {
  entry: LedgerEntry;
  replayed: boolean;
};

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `admin:${crypto.randomUUID()}`;
  }
  return `admin:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function WalletPanel() {
  const [accountId, setAccountId] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  async function loadWallet(id = accountId, cursor?: string) {
    const normalized = id.trim();
    if (!normalized) return;
    setLoading(true);
    try {
      const [walletResult, historyResult] = await Promise.all([
        apiFetch<Wallet>(`/admin/wallet/${encodeURIComponent(normalized)}`),
        apiFetch<History>(
          `/admin/wallet/${encodeURIComponent(normalized)}/history${
            cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
          }`
        )
      ]);
      setAccountId(normalized);
      setWallet(walletResult);
      setHistory((current) => (cursor ? [...current, ...historyResult.items] : historyResult.items));
      setNextCursor(historyResult.nextCursor);
      setMessage('Portefeuille chargé depuis le serveur.');
    } catch (cause) {
      if (!cursor) {
        setWallet(null);
        setHistory([]);
        setNextCursor(null);
      }
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger ce portefeuille.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWallet();
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get('amount'));
    const reason = String(data.get('reason') ?? '').trim();

    if (!Number.isSafeInteger(amount) || amount === 0) {
      setMessage('Le montant doit être un entier différent de zéro.');
      return;
    }

    setAdjusting(true);
    try {
      const result = await apiFetch<AdjustmentResult>('/admin/wallet/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          userId: accountId.trim(),
          amount,
          idempotencyKey,
          reason,
          referenceType: 'ADMIN_CASE',
          referenceId: idempotencyKey
        })
      });
      setMessage(
        result.replayed
          ? 'Cette opération avait déjà été appliquée : aucun double crédit.'
          : `Opération enregistrée : ${amount > 0 ? '+' : ''}${amount} KnowCoins.`
      );
      setIdempotencyKey(newIdempotencyKey());
      form.reset();
      await loadWallet(accountId.trim());
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer cet ajustement.'
      );
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <section style={{ marginTop: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: '#f4c95d' }}>ÉCONOMIE KNOWCOINS</small>
          <h2>Portefeuilles et registre</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
            Le solde est calculé par le serveur. Chaque mouvement conserve le
            solde avant et après et possède une clé empêchant les doubles crédits.
          </p>
        </div>
      </div>

      {message && (
        <p role="status" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      )}

      <form
        className="card"
        onSubmit={(event) => void search(event)}
        style={{ padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}
      >
        <input
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          required
          minLength={10}
          placeholder="accountId"
          style={{ flex: '1 1 300px' }}
        />
        <button className="btn" disabled={loading} type="submit">
          {loading ? 'Chargement…' : 'Charger le portefeuille'}
        </button>
      </form>

      {wallet && (
        <>
          <article className="card" style={{ padding: 22, marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong style={{ fontSize: 20 }}>{wallet.user.displayName}</strong>
                <div style={{ color: 'var(--muted)' }}>
                  @{wallet.user.username} · {wallet.user.email}
                </div>
                <code>{wallet.user.id}</code>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 34 }}>{wallet.balance}</strong>
                <div style={{ color: 'var(--muted)' }}>KnowCoins · v{wallet.version}</div>
              </div>
            </div>
          </article>

          <form
            className="card"
            onSubmit={(event) => void adjust(event)}
            style={{ padding: 22, display: 'grid', gap: 12, marginTop: 18 }}
          >
            <h3>Ajustement administratif</h3>
            <label>
              Montant entier
              <input
                name="amount"
                type="number"
                min={-1000000}
                max={1000000}
                step={1}
                required
                placeholder="100 pour créditer, -40 pour débiter"
              />
            </label>
            <label>
              Justification obligatoire
              <textarea name="reason" minLength={3} maxLength={500} rows={3} required />
            </label>
            <label>
              Clé d’idempotence
              <input value={idempotencyKey} readOnly />
            </label>
            <button className="btn btn-primary" disabled={adjusting} type="submit">
              {adjusting ? 'Écriture comptable…' : 'Enregistrer dans le registre'}
            </button>
          </form>

          <div style={{ marginTop: 24 }}>
            <h3>Historique immuable</h3>
            <div className="grid">
              {history.map((entry) => (
                <article className="card" key={entry.id} style={{ padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <strong style={{ color: entry.amount > 0 ? 'var(--mint)' : 'var(--orange)' }}>
                      {entry.amount > 0 ? '+' : ''}{entry.amount} KnowCoins
                    </strong>
                    <small>{new Date(entry.createdAt).toLocaleString('fr-FR')}</small>
                  </div>
                  <p>
                    {entry.balanceBefore} → <strong>{entry.balanceAfter}</strong>
                  </p>
                  <p style={{ color: 'var(--muted)' }}>
                    {entry.type} · {entry.source}
                  </p>
                  {entry.reason && <p>{entry.reason}</p>}
                  <code style={{ fontSize: 11 }}>{entry.idempotencyKey}</code>
                </article>
              ))}
              {!history.length && (
                <article className="card" style={{ padding: 18 }}>
                  Aucun mouvement enregistré.
                </article>
              )}
            </div>
            {nextCursor && (
              <button
                className="btn"
                disabled={loading}
                onClick={() => void loadWallet(accountId, nextCursor)}
                style={{ marginTop: 14 }}
              >
                Charger la suite
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
