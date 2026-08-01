'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '../../lib/api';

type UserSummary = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt?: string;
};

type DocumentSummary = {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt?: string;
  sha256?: string;
};

type VerificationRequest = {
  id: string;
  userId: string;
  subjectType: string;
  status: string;
  countryCode: string;
  publicCategory: string;
  publicReason?: string | null;
  submittedAt?: string | null;
  reviewStartedAt?: string | null;
  createdAt: string;
  documents: DocumentSummary[];
  user?: UserSummary | null;
  decisions?: Array<{
    id: string;
    action: string;
    reasonCode: string;
    userMessage?: string | null;
    internalNote?: string | null;
    reviewerId: string;
    createdAt: string;
  }>;
  identity?: {
    status: string;
    badgeLabel: string;
    category: string;
    verifiedAt: string;
    expiresAt?: string | null;
  } | null;
};

const STATUS_OPTIONS = ['', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'CANCELLED'];
const ACTIONS = ['NEEDS_INFO', 'APPROVE', 'REJECT', 'SUSPEND', 'REVOKE'];

export function VerificationPanel() {
  const [status, setStatus] = useState('SUBMITTED');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [action, setAction] = useState('APPROVE');
  const [reasonCode, setReasonCode] = useState('IDENTITY_CONFIRMED');
  const [userMessage, setUserMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('Compte certifié');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      setRequests(await apiFetch<VerificationRequest[]>(`/admin/verifications${query}`));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'File de certification indisponible.');
    }
  }, [status]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  async function openRequest(id: string) {
    setBusy(true);
    try {
      setSelected(await apiFetch<VerificationRequest>(`/admin/verifications/${id}`));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Demande introuvable.');
    } finally {
      setBusy(false);
    }
  }

  async function startReview() {
    if (!selected) return;
    setBusy(true);
    try {
      const detail = await apiFetch<VerificationRequest>(`/admin/verifications/${selected.id}/start-review`, { method: 'POST' });
      setSelected(detail);
      setMessage('Examen commencé. La demande est maintenant verrouillée pour décision.');
      await loadQueue();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de commencer l’examen.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!selected || !window.confirm(`Confirmer l’action ${action} ?`)) return;
    setBusy(true);
    try {
      const detail = await apiFetch<VerificationRequest>(`/admin/verifications/${selected.id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          reasonCode: reasonCode.trim(),
          userMessage: userMessage.trim() || undefined,
          internalNote: internalNote.trim() || undefined,
          badgeLabel: action === 'APPROVE' ? badgeLabel.trim() : undefined,
          expiresAt: action === 'APPROVE' && expiresAt ? new Date(expiresAt).toISOString() : undefined
        })
      });
      setSelected(detail);
      setMessage(`Décision ${action} enregistrée et notifiée.`);
      setUserMessage('');
      setInternalNote('');
      await loadQueue();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Décision impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(document: DocumentSummary) {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await apiDownload(`/admin/verifications/${selected.id}/documents/${document.id}`);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Document privé téléchargé pour examen local.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Téléchargement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: 'var(--orange)' }}>CONFIANCE</small>
          <h2>Certifications d’identité</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((value) => <option key={value || 'ALL'} value={value}>{value || 'TOUS LES STATUTS'}</option>)}
          </select>
          <button className="btn" onClick={() => void loadQueue()}>Actualiser</button>
        </div>
      </div>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(340px, 1.2fr)', alignItems: 'start' }}>
        <div className="grid">
          {requests.map((request) => (
            <button
              key={request.id}
              className="card"
              onClick={() => void openRequest(request.id)}
              style={{ padding: 18, textAlign: 'left', color: 'inherit', cursor: 'pointer', borderColor: selected?.id === request.id ? 'var(--mint)' : undefined }}
            >
              <strong>{request.user?.displayName ?? request.userId}</strong>
              <div style={{ color: 'var(--muted)' }}>@{request.user?.username ?? 'inconnu'} · {request.subjectType}</div>
              <div>{request.status} · {request.countryCode}</div>
              <small style={{ color: 'var(--muted)' }}>{request.documents.length} document(s)</small>
            </button>
          ))}
          {!requests.length && <article className="card" style={{ padding: 18, color: 'var(--muted)' }}>Aucune demande pour ce filtre.</article>}
        </div>

        {selected ? (
          <article className="card" style={{ padding: 24 }}>
            <small style={{ color: 'var(--orange)' }}>{selected.status}</small>
            <h3>{selected.user?.displayName ?? selected.userId}</h3>
            <p>@{selected.user?.username} · {selected.user?.email}</p>
            <p>{selected.subjectType} · {selected.publicCategory} · {selected.countryCode}</p>
            {selected.publicReason && <p>{selected.publicReason}</p>}
            <p style={{ color: 'var(--muted)' }}>Account ID : {selected.userId}</p>

            <h4>Documents privés</h4>
            <div className="grid">
              {selected.documents.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{doc.kind}</strong>
                    <div style={{ color: 'var(--muted)' }}>{doc.mimeType} · {Math.ceil(doc.sizeBytes / 1024)} Ko</div>
                    {doc.sha256 && <small style={{ color: 'var(--muted)' }}>SHA-256 : {doc.sha256.slice(0, 16)}…</small>}
                  </div>
                  <button className="btn" disabled={busy} onClick={() => void downloadDocument(doc)}>Télécharger</button>
                </div>
              ))}
            </div>

            {selected.status === 'SUBMITTED' && (
              <button className="btn btn-primary" disabled={busy} onClick={() => void startReview()} style={{ marginTop: 18 }}>Commencer l’examen</button>
            )}

            {selected.identity && (
              <div style={{ marginTop: 18, padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                <strong>Badge : {selected.identity.badgeLabel}</strong>
                <div>{selected.identity.status} · {selected.identity.category}</div>
              </div>
            )}

            {(selected.status === 'IN_REVIEW' || selected.identity) && (
              <form className="grid" onSubmit={decide} style={{ marginTop: 22 }}>
                <h4>Décision humaine</h4>
                <select className="input" value={action} onChange={(event) => setAction(event.target.value)}>
                  {ACTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <input className="input" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} placeholder="Code de décision" required minLength={2} maxLength={60} />
                <textarea className="input" value={userMessage} onChange={(event) => setUserMessage(event.target.value)} placeholder="Message visible par l’utilisateur" rows={3} maxLength={500} />
                <textarea className="input" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Note interne — jamais exposée au profil" rows={3} maxLength={1000} />
                {action === 'APPROVE' && <>
                  <input className="input" value={badgeLabel} onChange={(event) => setBadgeLabel(event.target.value)} placeholder="Libellé public du badge" minLength={2} maxLength={40} />
                  <label className="grid" style={{ gap: 6 }}>
                    <span>Expiration facultative</span>
                    <input className="input" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                  </label>
                </>}
                <button className="btn btn-primary" disabled={busy}>Enregistrer la décision</button>
              </form>
            )}

            {selected.decisions && selected.decisions.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h4>Historique d’examen</h4>
                <div className="grid">
                  {selected.decisions.map((decision) => (
                    <div key={decision.id}>
                      <strong>{decision.action} · {decision.reasonCode}</strong>
                      <div style={{ color: 'var(--muted)' }}>{new Date(decision.createdAt).toLocaleString('fr-FR')}</div>
                      {decision.userMessage && <p>{decision.userMessage}</p>}
                      {decision.internalNote && <p style={{ color: 'var(--muted)' }}>Interne : {decision.internalNote}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        ) : (
          <article className="card" style={{ padding: 24, color: 'var(--muted)' }}>Sélectionne une demande pour l’examiner.</article>
        )}
      </div>
    </section>
  );
}
