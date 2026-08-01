'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Evidence = {
  id: string;
  type: string;
  provider: string;
  opaqueReference: string;
  digest: string;
  createdAt: string;
};
type Decision = {
  id: string;
  action: string;
  previousStatus: string;
  nextStatus: string;
  reason: string;
  expiresAt?: string | null;
  createdAt: string;
};
type VerificationRequest = {
  id: string;
  submissionNumber: number;
  status: string;
  level: string;
  displayNameClaim?: string | null;
  countryCode?: string | null;
  evidenceCount: number;
  submittedAt: string;
  reviewStartedAt?: string | null;
  decidedAt?: string | null;
  expiresAt?: string | null;
  decisionReason?: string | null;
  decisionVersion: number;
  evidence: Evidence[];
  decisions: Decision[];
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Soumise',
  UNDER_REVIEW: 'En cours d’examen',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
  REVOKED: 'Révoquée',
  EXPIRED: 'Expirée',
  WITHDRAWN: 'Retirée'
};

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function VerificationPage() {
  const { user, loading: sessionLoading, refresh } = useSession({ required: true });
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await apiFetch<VerificationRequest[]>('/verification/me'));
      setMessage('');
    } catch (cause) {
      setMessage(errorMessage(cause, 'Chargement des demandes impossible.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const digest = String(form.get('digest') ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      setMessage('L’empreinte doit contenir exactement 64 caractères hexadécimaux.');
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/verification/requests', {
        method: 'POST',
        body: JSON.stringify({
          displayNameClaim: String(form.get('displayNameClaim') ?? '').trim(),
          countryCode: String(form.get('countryCode') ?? '').trim().toUpperCase() || undefined,
          evidence: [
            {
              type: String(form.get('type') ?? 'PROVIDER_ASSERTION'),
              provider: String(form.get('provider') ?? '').trim().toUpperCase(),
              opaqueReference: String(form.get('opaqueReference') ?? '').trim(),
              digest
            }
          ]
        })
      });
      event.currentTarget.reset();
      setMessage('Demande soumise. Aucune image de document n’a été stockée par KnowMe.');
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setMessage(errorMessage(cause, 'Soumission impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(request: VerificationRequest) {
    const reason = window.prompt('Motif du retrait de la demande :');
    if (!reason?.trim() || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });
      setMessage('Demande retirée.');
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setMessage(errorMessage(cause, 'Retrait impossible.'));
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || loading || !user) {
    return <main className="shell"><p>Chargement de la vérification…</p></main>;
  }

  const pending = requests.some((item) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)
  );
  const approved = requests.find(
    (item) => item.status === 'APPROVED' && item.expiresAt && new Date(item.expiresAt) > new Date()
  );

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: '#65b7ff' }}>IDENTITÉ KNOWME</small>
          <h1>Vérification autoritaire</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
            Le badge Vérifié vient exclusivement d’une décision active du serveur. Il est
            indépendant de Premium et du badge officiel Équipe KnowMe.
          </p>
        </div>
        <Link href="/profile" className="btn">Retour au profil</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 24 }}>
        <article className="card" style={{ padding: 20 }}>
          <small>IDENTITÉ VÉRIFIÉE</small>
          <h2 style={{ color: user.verification ? '#65b7ff' : 'var(--muted)' }}>
            {user.verification ? 'Active' : 'Inactive'}
          </h2>
          {user.verification?.expiresAt && <p>Valide jusqu’au {new Date(user.verification.expiresAt).toLocaleDateString('fr-FR')}.</p>}
        </article>
        <article className="card" style={{ padding: 20 }}>
          <small>PREMIUM</small>
          <h2 style={{ color: user.premium ? '#f4c95d' : 'var(--muted)' }}>
            {user.premium ? 'Actif' : 'Inactif'}
          </h2>
          <p>Premium ne confère jamais le badge Vérifié.</p>
        </article>
        <article className="card" style={{ padding: 20 }}>
          <small>ÉQUIPE KNOWME</small>
          <h2 style={{ color: user.staff ? '#f4c95d' : 'var(--muted)' }}>
            {user.staff ? 'Compte officiel' : 'Compte utilisateur'}
          </h2>
          <p>Le registre du personnel est entièrement séparé.</p>
        </article>
      </section>

      {!pending && !approved && (
        <form className="card grid" onSubmit={submit} style={{ padding: 24, marginBottom: 28 }}>
          <div>
            <small style={{ color: 'var(--mint)' }}>NOUVELLE DEMANDE</small>
            <h2>Référencer une preuve</h2>
            <p style={{ color: 'var(--muted)' }}>
              KnowMe ne reçoit ici ni photo ni numéro de document. Le flux conserve seulement
              une référence opaque et l’empreinte SHA-256 du contenu détenu par le prestataire
              autorisé.
            </p>
          </div>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Nom à vérifier</strong>
            <input className="input" name="displayNameClaim" defaultValue={user.displayName} minLength={2} maxLength={100} required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Pays ISO</strong>
            <input className="input" name="countryCode" placeholder="BJ" pattern="[A-Za-z]{2}" maxLength={2} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Type de preuve</strong>
            <select className="input" name="type" defaultValue="PROVIDER_ASSERTION">
              <option value="PROVIDER_ASSERTION">Assertion du prestataire</option>
              <option value="IDENTITY_DOCUMENT">Document d’identité référencé</option>
              <option value="SELFIE_CHECK">Contrôle de présence référencé</option>
              <option value="ADDRESS_CHECK">Adresse référencée</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Prestataire</strong>
            <input className="input" name="provider" placeholder="KYC_PROVIDER" pattern="[A-Za-z0-9_]{2,32}" required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Référence opaque</strong>
            <input className="input" name="opaqueReference" placeholder="ref_xxxxxxxxx" minLength={8} maxLength={200} required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Empreinte SHA-256</strong>
            <input className="input" name="digest" placeholder="64 caractères hexadécimaux" minLength={64} maxLength={64} required />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Soumission…' : 'Soumettre pour examen'}
          </button>
        </form>
      )}

      <section>
        <h2>Historique immuable</h2>
        <div className="grid">
          {requests.map((request) => (
            <article className="card" key={request.id} style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>Demande #{request.submissionNumber}</strong>
                <span style={{ color: request.status === 'APPROVED' ? '#65b7ff' : 'var(--orange)' }}>
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>
              <p style={{ color: 'var(--muted)' }}>
                Soumise le {new Date(request.submittedAt).toLocaleString('fr-FR')} · {request.evidenceCount} référence(s)
              </p>
              {request.expiresAt && <p>Échéance : {new Date(request.expiresAt).toLocaleString('fr-FR')}</p>}
              {request.decisionReason && <p><strong>Motif :</strong> {request.decisionReason}</p>}
              <details>
                <summary>Références et décisions</summary>
                {request.evidence.map((item) => (
                  <p key={item.id} style={{ overflowWrap: 'anywhere' }}>
                    {item.type} · {item.provider} · {item.opaqueReference}<br />
                    <code>{item.digest}</code>
                  </p>
                ))}
                {request.decisions.map((decision) => (
                  <p key={decision.id}>
                    {new Date(decision.createdAt).toLocaleString('fr-FR')} · {decision.action} · {decision.reason}
                  </p>
                ))}
              </details>
              {['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
                <button className="btn" disabled={busy} onClick={() => void withdraw(request)}>
                  Retirer la demande
                </button>
              )}
            </article>
          ))}
          {!requests.length && <article className="card" style={{ padding: 22, color: 'var(--muted)' }}>Aucune demande enregistrée.</article>}
        </div>
      </section>
    </main>
  );
}
