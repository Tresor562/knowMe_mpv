'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type CatalogItem = { key: string; title: string; description: string };
type Account = { id: string; displayName: string; username: string };
type PositiveChallenge = {
  id: string;
  kind: string;
  title: string;
  description: string;
  note: string | null;
  status: string;
  role: 'CREATOR' | 'RECIPIENT';
  creator: Account | null;
  recipient: Account | null;
  creatorConfirmedAt: string | null;
  recipientConfirmedAt: string | null;
  expiresAt: string;
};

type ChallengeResponse = {
  items: PositiveChallenge[];
  rules: {
    explicitConsent: boolean;
    refusalPenalty: boolean;
    doubleConfirmation: boolean;
    reward: null;
    paidBoostsAllowed: boolean;
  };
};

export default function PositiveChallengesPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [data, setData] = useState<ChallengeResponse | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [kind, setKind] = useState('GRATITUDE_NOTE');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [authorityFresh, setAuthorityFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadGeneration = useRef(0);

  const invalidateAuthority = useCallback(() => {
    loadGeneration.current += 1;
    setAuthorityFresh(false);
    setCatalog([]);
    setData(null);
  }, []);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setAuthorityFresh(false);
    setCatalog([]);
    setData(null);
    setMessage('');

    try {
      const [catalogResponse, challenges] = await Promise.all([
        apiFetch<{ items: CatalogItem[] }>('/positive-challenges/catalog'),
        apiFetch<ChallengeResponse>('/positive-challenges/me')
      ]);
      if (generation !== loadGeneration.current) return;
      setCatalog(catalogResponse.items);
      setData(challenges);
      setAuthorityFresh(true);
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setCatalog([]);
      setData(null);
      setAuthorityFresh(false);
      setMessage(cause instanceof Error ? cause.message : 'Positive Challenges indisponibles.');
    }
  }, []);

  useEffect(() => {
    invalidateAuthority();
    setBusy(false);
    setRecipientId('');
    setNote('');
    if (!sessionLoading && user) void load();
    return () => {
      loadGeneration.current += 1;
    };
  }, [invalidateAuthority, load, sessionLoading, user?.id]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!authorityFresh || busy || !data) return;
    setBusy(true);
    try {
      await apiFetch('/positive-challenges', {
        method: 'POST',
        body: JSON.stringify({ recipientId, kind, note: note.trim() || undefined })
      });
      setRecipientId('');
      setNote('');
      setMessage('Invitation envoyée. Ton ami peut refuser sans aucune pénalité.');
      await load();
    } catch (cause) {
      invalidateAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, actionName: 'accept' | 'decline' | 'confirm' | 'cancel') {
    if (!authorityFresh || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/positive-challenges/${id}/${actionName}`, { method: 'PATCH' });
      await load();
    } catch (cause) {
      invalidateAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !user || !authorityFresh || !data) {
    return <main className="shell"><p>{message || 'Chargement des Positive Challenges…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>POSITIVE CHALLENGES</small>
        <h1>Des défis relationnels consentis</h1>
        <p style={{ color: 'var(--muted)' }}>
          Aucun refus ne retire d’XP, de KnowCoins ou de série. Une réalisation n’est validée
          qu’après confirmation des deux personnes.
        </p>
      </header>

      {message && <p role="status">{message}</p>}

      <form className="card" style={{ padding: 22, display: 'grid', gap: 12 }} onSubmit={create}>
        <h2>Proposer à un ami</h2>
        <label>
          Identifiant du compte ami
          <input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required disabled={busy} />
        </label>
        <label>
          Défi positif
          <select value={kind} onChange={(event) => setKind(event.target.value)} disabled={busy}>
            {catalog.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
          </select>
        </label>
        <label>
          Note facultative, sans donnée sensible
          <textarea maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!authorityFresh || busy}>Envoyer l’invitation</button>
      </form>

      <section style={{ display: 'grid', gap: 14, marginTop: 24 }}>
        {data.items.length === 0 && <div className="card" style={{ padding: 20 }}>Aucun défi positif pour le moment.</div>}
        {data.items.map((item) => {
          const other = item.role === 'CREATOR' ? item.recipient : item.creator;
          const canRespond = item.role === 'RECIPIENT' && item.status === 'INVITED';
          const canConfirm = ['ACCEPTED', 'COMPLETION_PENDING'].includes(item.status) &&
            !(item.role === 'CREATOR' ? item.creatorConfirmedAt : item.recipientConfirmedAt);
          const canCancel = item.role === 'CREATOR' && ['INVITED', 'ACCEPTED', 'COMPLETION_PENDING'].includes(item.status);
          return (
            <article className="card" style={{ padding: 20 }} key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2>{item.title}</h2>
                  <p style={{ color: 'var(--muted)' }}>{item.description}</p>
                  <p>Avec {other?.displayName ?? 'un ami'} · Statut : <strong>{item.status}</strong></p>
                  {item.note && <blockquote>{item.note}</blockquote>}
                  <small>Expire le {new Date(item.expiresAt).toLocaleString('fr-FR')}</small>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {canRespond && <button className="btn btn-primary" disabled={busy} onClick={() => void action(item.id, 'accept')}>Accepter</button>}
                  {canRespond && <button className="btn" disabled={busy} onClick={() => void action(item.id, 'decline')}>Refuser librement</button>}
                  {canConfirm && <button className="btn btn-primary" disabled={busy} onClick={() => void action(item.id, 'confirm')}>Confirmer la réalisation</button>}
                  {canCancel && <button className="btn" disabled={busy} onClick={() => void action(item.id, 'cancel')}>Annuler sans pénalité</button>}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
