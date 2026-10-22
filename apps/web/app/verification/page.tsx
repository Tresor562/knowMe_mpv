'use client';

import Link from 'next/link';
import { useI18n } from '../../components/i18n-provider';
import { knowMeConfirm, knowMePrompt } from '../../components/knowme-feedback';
import {
  canSubmitVerificationRequest, verificationWithdrawalReason
} from '../../lib/verification-request-model';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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

const STATUS_LABELS: Record<string, readonly [string, string]> = {
  SUBMITTED: ['Soumise', 'Submitted'],
  UNDER_REVIEW: ['En cours d’examen', 'Under review'],
  APPROVED: ['Approuvée', 'Approved'],
  REJECTED: ['Refusée', 'Rejected'],
  REVOKED: ['Révoquée', 'Revoked'],
  EXPIRED: ['Expirée', 'Expired'],
  WITHDRAWN: ['Retirée', 'Withdrawn']
};

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function VerificationPage() {
  const { user, loading: sessionLoading, refresh } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const dateLocale = en ? 'en-US' : 'fr-FR';
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const loadedAccountId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequests(await apiFetch<VerificationRequest[]>('/verification/me'));
      setLoadError(false);
      setMessage('');
      return true;
    } catch (cause) {
      setLoadError(true);
      setMessage(errorMessage(cause, 'Chargement des demandes impossible.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading || !user || loadedAccountId.current === user.id) return;
    // A routine useSession.refresh() briefly clears/restores the same user.
    // Only load when the active account really changes, avoiding duplicate
    // GETs that could erase acknowledged POST success messages.
    loadedAccountId.current = user.id;
    void load();
  }, [load, sessionLoading, user?.id]);

  /**
   * The POST already succeeded. A later GET/session refresh failure must
   * not turn the acknowledged mutation into a false failure or encourage replay.
   */
  async function syncAfterVerifiedMutation(success: string, partial: string) {
    const [list, session] = await Promise.allSettled([load(), refresh()]);
    const synced = list.status === 'fulfilled' && list.value === true &&
      session.status === 'fulfilled';
    setMessage(synced ? success : partial);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loadError) return;
    // React event.currentTarget is not retained across awaited requests.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const digest = String(form.get('digest') ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      setMessage(tr('L’empreinte doit contenir exactement 64 caractères hexadécimaux.',
        'The fingerprint must have exactly 64 hexadecimal characters.'));
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
      formElement.reset();
      await syncAfterVerifiedMutation(
        tr('Demande soumise. Aucune image de document n’a été stockée par KnowMe.',
          'Request submitted. KnowMe did not store any identity document image.'),
        tr('Demande soumise. Actualisation temporairement indisponible.',
          'Request submitted. Refresh is temporarily unavailable.')
      );
    } catch (cause) {
      setMessage(errorMessage(cause, 'Soumission impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(request: VerificationRequest) {
    if (busy || loadError) return;
    const typed = await knowMePrompt(tr(
      'Pourquoi retirer cette demande ? (3 à 500 caractères)',
      'Why withdraw this request? (3–500 characters)'
    ));
    if (typed === null) return;
    const reason = verificationWithdrawalReason(typed);
    if (!reason) {
      setMessage(tr('Le motif doit contenir entre 3 et 500 caractères.',
        'The reason must contain between 3 and 500 characters.'));
      return;
    }
    if (!await knowMeConfirm(tr(
      'Confirmer le retrait de ta demande de vérification ?',
      'Confirm withdrawal of your verification request?'
    ))) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${encodeURIComponent(request.id)}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await syncAfterVerifiedMutation(
        tr('Demande retirée.', 'Request withdrawn.'),
        tr('Demande retirée. Actualisation temporairement indisponible.',
          'Request withdrawn. Refresh is temporarily unavailable.')
      );
    } catch (cause) {
      setMessage(errorMessage(cause, tr('Retrait impossible.', 'Could not withdraw request.')));
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || loading || !user) {
    return <main className="shell"><p>{tr('Chargement de la vérification…', 'Loading verification…')}</p></main>;
  }

  const canSubmit = !loadError && canSubmitVerificationRequest(requests);

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: '#65b7ff' }}>{tr('IDENTITÉ KNOWME', 'KNOWME IDENTITY')}</small>
          <h1>{tr('Vérification de l’identité', 'Identity verification')}</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
            {tr('Le badge Vérifié dépend exclusivement d’une décision active du serveur. Il est indépendant de Premium et du badge officiel Équipe KnowMe.',
              'The Verified badge requires an active server decision. It is separate from Premium and the official KnowMe Team badge.')}
          </p>
        </div>
        <Link href="/profile" className="btn">{tr('Retour au profil', 'Back to profile')}</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {loadError ? (
        <section className="card" style={{ padding: 16, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ flex: 1, margin: 0 }}>
            {tr('Impossible de vérifier les demandes actuelles. Aucun nouvel envoi ne sera proposé.',
              'Current requests could not be verified. New submissions are disabled.')}
          </p>
          <button type="button" className="btn" disabled={busy}
            onClick={() => void load()}>{tr('Réessayer', 'Retry')}</button>
        </section>
      ) : null}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 24 }}>
        <article className="card" style={{ padding: 20 }}>
          <small>{tr('IDENTITÉ VÉRIFIÉE', 'VERIFIED IDENTITY')}</small>
          <h2 style={{ color: user.verification ? '#65b7ff' : 'var(--muted)' }}>
            {user.verification ? tr('Active', 'Active') : tr('Inactive', 'Inactive')}
          </h2>
          {user.verification?.expiresAt && <p>{tr('Valide jusqu’au', 'Valid until')} {new Date(user.verification.expiresAt).toLocaleDateString(dateLocale)}.</p>}
        </article>
        <article className="card" style={{ padding: 20 }}>
          <small>PREMIUM</small>
          <h2 style={{ color: user.premium ? '#f4c95d' : 'var(--muted)' }}>
            {user.premium ? tr('Actif', 'Active') : tr('Inactif', 'Inactive')}
          </h2>
          <p>{tr('Premium ne confère jamais le badge Vérifié.', 'Premium never grants the Verified badge.')}</p>
        </article>
        <article className="card" style={{ padding: 20 }}>
          <small>{tr('ÉQUIPE KNOWME', 'KNOWME TEAM')}</small>
          <h2 style={{ color: user.staff ? '#f4c95d' : 'var(--muted)' }}>
            {user.staff ? tr('Compte officiel', 'Official account') : tr('Compte utilisateur', 'User account')}
          </h2>
          <p>{tr('Les comptes de l’équipe sont gérés séparément.', 'Team accounts are managed separately.')}</p>
        </article>
      </section>

      {canSubmit && (
        <form className="card grid" onSubmit={submit} style={{ padding: 24, marginBottom: 28 }}>
          <div>
            <small style={{ color: 'var(--mint)' }}>{tr('NOUVELLE DEMANDE', 'NEW REQUEST')}</small>
            <h2>{tr('Référencer une preuve', 'Provide proof reference')}</h2>
            <p style={{ color: 'var(--muted)' }}>
              {tr('KnowMe ne reçoit ici ni photo ni numéro de document. Seules une référence opaque et l’empreinte SHA-256 sont transmises.',
                'KnowMe does not receive document photos or ID numbers here. Only an opaque reference and its SHA-256 fingerprint are submitted.')}
            </p>
          </div>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Nom à vérifier', 'Name to verify')}</strong>
            <input className="input" name="displayNameClaim" defaultValue={user.displayName} minLength={2} maxLength={100} required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Pays ISO', 'ISO country')}</strong>
            <input className="input" name="countryCode" placeholder="BJ" pattern="[A-Za-z]{2}" maxLength={2} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Type de preuve', 'Evidence type')}</strong>
            <select className="input" name="type" defaultValue="PROVIDER_ASSERTION">
              <option value="PROVIDER_ASSERTION">{tr('Attestation du prestataire', 'Provider attestation')}</option>
              <option value="IDENTITY_DOCUMENT">{tr('Document d’identité référencé', 'Identity document reference')}</option>
              <option value="SELFIE_CHECK">{tr('Contrôle de présence référencé', 'Presence check reference')}</option>
              <option value="ADDRESS_CHECK">{tr('Adresse référencée', 'Address reference')}</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Prestataire', 'Provider')}</strong>
            <input className="input" name="provider" placeholder="KYC_PROVIDER" pattern="[A-Za-z0-9_]{2,32}" required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Référence opaque', 'Opaque reference')}</strong>
            <input className="input" name="opaqueReference" placeholder="ref_xxxxxxxxx" minLength={8} maxLength={200} required />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>{tr('Empreinte SHA-256', 'SHA-256 fingerprint')}</strong>
            <input className="input" name="digest" placeholder="64 caractères hexadécimaux" minLength={64} maxLength={64} required />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? tr('Soumission…', 'Submitting…') : tr('Soumettre pour examen', 'Submit for review')}
          </button>
        </form>
      )}

      <section>
        <h2>{tr('Historique des demandes', 'Request history')}</h2>
        <div className="grid">
          {requests.map((request) => (
            <article className="card" key={request.id} style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{tr('Demande', 'Request')} #{request.submissionNumber}</strong>
                <span style={{ color: request.status === 'APPROVED' ? '#65b7ff' : 'var(--orange)' }}>
                  {STATUS_LABELS[request.status]?.[en ? 1 : 0] ?? request.status}
                </span>
              </div>
              <p style={{ color: 'var(--muted)' }}>
                {tr('Soumise le', 'Submitted on')} {new Date(request.submittedAt).toLocaleString(dateLocale)} · {request.evidenceCount} {tr(request.evidenceCount === 1 ? 'référence' : 'références', request.evidenceCount === 1 ? 'reference' : 'references')}
              </p>
              {request.expiresAt && <p>{tr('Échéance', 'Expires')}: {new Date(request.expiresAt).toLocaleString(dateLocale)}</p>}
              {request.decisionReason && <p><strong>{tr('Motif', 'Reason')}:</strong> {request.decisionReason}</p>}
              <details>
                <summary>{tr('Références et décisions', 'Evidence and decisions')}</summary>
                {request.evidence.map((item) => (
                  <p key={item.id} style={{ overflowWrap: 'anywhere' }}>
                    {item.type} · {item.provider} · {item.opaqueReference}<br />
                    <code>{item.digest}</code>
                  </p>
                ))}
                {request.decisions.map((decision) => (
                  <p key={decision.id}>
                    {new Date(decision.createdAt).toLocaleString(dateLocale)} · {decision.action} · {decision.reason}
                  </p>
                ))}
              </details>
              {['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
                <button className="btn" type="button" disabled={busy || loadError} onClick={() => void withdraw(request)}>
                  {tr('Retirer la demande', 'Withdraw request')}
                </button>
              )}
            </article>
          ))}
          {!requests.length && <article className="card" style={{ padding: 22, color: 'var(--muted)' }}>{tr('Aucune demande enregistrée.', 'No requests yet.')}</article>}
        </div>
      </section>
    </main>
  );
}
