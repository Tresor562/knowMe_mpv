'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Applicant = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
};
type Reviewer = {
  id: string;
  username: string;
  displayName: string;
};
type Evidence = {
  id: string;
  type: string;
  provider: string;
  opaqueReference: string;
  digest: string;
  metadata?: Record<string, unknown> | null;
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
  reviewer?: Reviewer | null;
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
  reviewerId?: string | null;
  decisionReason?: string | null;
  decisionVersion: number;
  applicant: Applicant;
  reviewer?: Reviewer | null;
  evidence: Evidence[];
  decisions: Decision[];
};

const STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
  'WITHDRAWN'
] as const;

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function VerificationPanel() {
  const [status, setStatus] = useState('SUBMITTED');
  const [items, setItems] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await apiFetch<VerificationRequest[]>(
          `/admin/verification/requests?status=${encodeURIComponent(status)}`
        )
      );
      setFeedback('');
    } catch (cause) {
      setFeedback(message(cause, 'Chargement de la file impossible.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(
    item: VerificationRequest,
    action: 'start' | 'approve' | 'reject' | 'revoke'
  ) {
    if (busyId) return;
    let body: Record<string, unknown> = {
      expectedDecisionVersion: item.decisionVersion
    };

    if (action !== 'start') {
      const reason = window.prompt(
        action === 'approve'
          ? 'Motif de l’approbation :'
          : action === 'revoke'
            ? 'Motif détaillé de la révocation :'
            : 'Motif détaillé du refus :'
      );
      if (!reason?.trim()) return;
      body = { ...body, reason: reason.trim() };

      if (action === 'approve') {
        const rawDays = window.prompt(
          'Durée de validité en jours, entre 30 et 730 :',
          '365'
        );
        if (!rawDays) return;
        const expiresInDays = Number(rawDays);
        if (!Number.isInteger(expiresInDays) || expiresInDays < 30 || expiresInDays > 730) {
          setFeedback('La durée doit être un entier compris entre 30 et 730 jours.');
          return;
        }
        body.expiresInDays = expiresInDays;
      }
    }

    setBusyId(item.id);
    try {
      await apiFetch(`/admin/verification/requests/${item.id}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      setFeedback(
        action === 'start'
          ? 'Demande prise en charge.'
          : action === 'approve'
            ? 'Identité approuvée et badge activé.'
            : action === 'revoke'
              ? 'Badge révoqué immédiatement.'
              : 'Demande refusée.'
      );
      await load();
    } catch (cause) {
      setFeedback(message(cause, 'Transition impossible. Recharge la file.'));
    } finally {
      setBusyId('');
    }
  }

  async function reconcileExpired() {
    if (busyId) return;
    setBusyId('reconcile');
    try {
      const result = await apiFetch<{ examined: number; expired: number }>(
        '/admin/verification/reconcile-expired',
        { method: 'POST' }
      );
      setFeedback(
        `${result.examined} demande(s) examinée(s), ${result.expired} badge(s) expiré(s).`
      );
      await load();
    } catch (cause) {
      setFeedback(message(cause, 'Réconciliation impossible.'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: '#65b7ff' }}>CONFIANCE ET IDENTITÉ</small>
          <h2>File de vérification</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
            Les preuves restent des références opaques. Chaque décision est versionnée,
            attribuée et auditée ; Premium et Équipe KnowMe ne modifient jamais cet état.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            className="input"
            aria-label="Filtrer par statut"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button className="btn" disabled={Boolean(busyId)} onClick={() => void load()}>
            Actualiser
          </button>
          <button
            className="btn btn-accent"
            disabled={Boolean(busyId)}
            onClick={() => void reconcileExpired()}
          >
            Réconcilier les expirations
          </button>
        </div>
      </div>

      {feedback && <p role="alert" style={{ color: 'var(--orange)' }}>{feedback}</p>}
      {loading && <p>Chargement de la file…</p>}

      {!loading && (
        <div className="grid">
          {items.map((item) => (
            <article className="card" key={item.id} style={{ padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <strong style={{ fontSize: 19 }}>{item.applicant.displayName}</strong>
                  <div style={{ color: 'var(--muted)' }}>
                    @{item.applicant.username} · {item.applicant.email}
                  </div>
                  <small>ID compte : {item.applicant.id}</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: item.status === 'APPROVED' ? '#65b7ff' : 'var(--orange)' }}>
                    {item.status}
                  </strong>
                  <div>Soumission #{item.submissionNumber}</div>
                  <small>Version {item.decisionVersion}</small>
                </div>
              </div>

              <p>
                Nom revendiqué : <strong>{item.displayNameClaim || 'Non renseigné'}</strong>
                {item.countryCode ? ` · ${item.countryCode}` : ''}
              </p>
              <p style={{ color: 'var(--muted)' }}>
                Compte créé le {new Date(item.applicant.createdAt).toLocaleString('fr-FR')} ·
                demande soumise le {new Date(item.submittedAt).toLocaleString('fr-FR')}
              </p>
              {item.reviewer && (
                <p>
                  Examinateur : {item.reviewer.displayName} (@{item.reviewer.username})
                </p>
              )}
              {item.expiresAt && (
                <p>Expiration : {new Date(item.expiresAt).toLocaleString('fr-FR')}</p>
              )}
              {item.decisionReason && <p><strong>Motif courant :</strong> {item.decisionReason}</p>}

              <details>
                <summary>{item.evidenceCount} référence(s) de preuve</summary>
                {item.evidence.map((evidence) => (
                  <div key={evidence.id} style={{ marginTop: 12, overflowWrap: 'anywhere' }}>
                    <strong>{evidence.type}</strong> · {evidence.provider}<br />
                    Référence : <code>{evidence.opaqueReference}</code><br />
                    Empreinte : <code>{evidence.digest}</code>
                  </div>
                ))}
              </details>

              <details>
                <summary>Historique des décisions</summary>
                {item.decisions.map((decision) => (
                  <p key={decision.id}>
                    {new Date(decision.createdAt).toLocaleString('fr-FR')} ·
                    {' '}{decision.previousStatus} → {decision.nextStatus} · {decision.reason}
                    {decision.reviewer ? ` · ${decision.reviewer.displayName}` : ''}
                  </p>
                ))}
              </details>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {item.status === 'SUBMITTED' && (
                  <button
                    className="btn btn-primary"
                    disabled={Boolean(busyId)}
                    onClick={() => void transition(item, 'start')}
                  >
                    Prendre en charge
                  </button>
                )}
                {item.status === 'UNDER_REVIEW' && (
                  <>
                    <button
                      className="btn btn-primary"
                      disabled={Boolean(busyId)}
                      onClick={() => void transition(item, 'approve')}
                    >
                      Approuver
                    </button>
                    <button
                      className="btn"
                      disabled={Boolean(busyId)}
                      onClick={() => void transition(item, 'reject')}
                    >
                      Refuser
                    </button>
                  </>
                )}
                {item.status === 'APPROVED' && (
                  <button
                    className="btn"
                    disabled={Boolean(busyId)}
                    onClick={() => void transition(item, 'revoke')}
                  >
                    Révoquer le badge
                  </button>
                )}
              </div>
            </article>
          ))}
          {!items.length && (
            <article className="card" style={{ padding: 22, color: 'var(--muted)' }}>
              Aucune demande dans cette file.
            </article>
          )}
        </div>
      )}
    </section>
  );
}
