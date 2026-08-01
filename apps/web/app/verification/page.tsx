'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type VerificationDocument = {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

type VerificationDecision = {
  id: string;
  action: string;
  reasonCode: string;
  userMessage?: string | null;
  createdAt: string;
};

type VerificationRequest = {
  id: string;
  subjectType: string;
  status: string;
  countryCode: string;
  publicCategory: string;
  publicReason?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  documents: VerificationDocument[];
  decisions: VerificationDecision[];
};

type VerificationState = {
  request: VerificationRequest | null;
  badge: {
    verified: true;
    label: string;
    category: string;
    verifiedAt: string;
    expiresAt?: string | null;
  } | null;
  identityStatus: string;
  canCreateNew: boolean;
};

const DOCUMENT_LABELS: Record<string, string> = {
  IDENTITY_FRONT: 'Pièce d’identité — recto',
  IDENTITY_BACK: 'Pièce d’identité — verso',
  SELFIE: 'Selfie de vérification',
  REGISTRATION: 'Document d’enregistrement',
  AUTHORIZATION: 'Autorisation du représentant',
  SUPPORTING_EVIDENCE: 'Justificatif complémentaire'
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Envoyée',
  IN_REVIEW: 'En cours d’examen',
  NEEDS_INFO: 'Informations supplémentaires demandées',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée'
};

export default function VerificationPage() {
  const { loading: sessionLoading } = useSession({ required: true });
  const [state, setState] = useState<VerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [subjectType, setSubjectType] = useState('PERSON');
  const [countryCode, setCountryCode] = useState('BJ');
  const [publicCategory, setPublicCategory] = useState('PERSON');
  const [publicReason, setPublicReason] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [documentKind, setDocumentKind] = useState('IDENTITY_FRONT');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await apiFetch<VerificationState>('/verification/me'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de charger la certification.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const request = state?.request ?? null;
  const canEdit = request && ['DRAFT', 'NEEDS_INFO'].includes(request.status);
  const canCancel = request && ['DRAFT', 'SUBMITTED', 'NEEDS_INFO'].includes(request.status);
  const showCreateForm = state?.canCreateNew ?? !request;
  const requiredKinds = useMemo(
    () => subjectType === 'ORGANIZATION'
      ? ['REGISTRATION', 'AUTHORIZATION']
      : ['IDENTITY_FRONT', 'SELFIE'],
    [subjectType]
  );

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/verification/requests', {
        method: 'POST',
        body: JSON.stringify({
          subjectType,
          countryCode: countryCode.trim().toUpperCase(),
          publicCategory,
          publicReason: publicReason.trim() || undefined,
          termsVersion: '2026-08-identity-v1',
          termsAccepted
        })
      });
      setTermsAccepted(false);
      setPublicReason('');
      setMessage('Demande créée. Ajoute maintenant les documents requis.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: FormEvent) {
    event.preventDefault();
    if (!request || !file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('kind', documentKind);
      body.append('file', file);
      await apiFetch(`/verification/requests/${request.id}/documents`, {
        method: 'POST',
        body
      });
      setFile(null);
      setMessage('Document ajouté dans l’espace privé de vérification.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(documentId: string) {
    if (!request || !window.confirm('Retirer ce document de la demande ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/documents/${documentId}`, {
        method: 'DELETE'
      });
      setMessage('Document retiré.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!request || !window.confirm('Envoyer cette demande à l’équipe KnowMe ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/submit`, { method: 'POST' });
      setMessage('Demande envoyée pour examen humain.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!request || !window.confirm('Annuler cette demande de certification ?')) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/cancel`, { method: 'POST' });
      setMessage('Demande annulée. Tu peux en créer une nouvelle lorsque tu es prêt.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Annulation impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || loading) {
    return <main className="shell"><p>Chargement de la certification…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 960, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--orange)' }}>CONFIANCE KNOWME</small>
        <h1>Certification du compte</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
          Le badge certifié confirme qu’une identité ou une organisation a été examinée par l’équipe KnowMe. Premium ne donne jamais automatiquement ce badge.
        </p>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      {state?.badge && (
        <article className="card" style={{ padding: 24, borderColor: 'var(--mint)' }}>
          <small style={{ color: 'var(--mint)' }}>BADGE ACTIF</small>
          <h2>✓ {state.badge.label}</h2>
          <p>Catégorie : {state.badge.category}</p>
          <p style={{ color: 'var(--muted)' }}>
            Vérifié le {new Date(state.badge.verifiedAt).toLocaleDateString('fr-FR')}
            {state.badge.expiresAt ? ` · expire le ${new Date(state.badge.expiresAt).toLocaleDateString('fr-FR')}` : ''}
          </p>
        </article>
      )}

      {showCreateForm && (
        <form className="card grid" onSubmit={createRequest} style={{ padding: 24, marginTop: 24 }}>
          <h2>{request ? 'Créer une nouvelle demande' : 'Créer une demande'}</h2>
          {request && <p style={{ color: 'var(--muted)' }}>La demande précédente est terminée. Son historique reste visible ci-dessous.</p>}
          <label className="grid" style={{ gap: 8 }}>
            <span>Type de demande</span>
            <select className="input" value={subjectType} onChange={(event) => setSubjectType(event.target.value)}>
              <option value="PERSON">Personne</option>
              <option value="CREATOR">Créateur</option>
              <option value="ORGANIZATION">Organisation</option>
            </select>
          </label>
          <label className="grid" style={{ gap: 8 }}>
            <span>Pays du document</span>
            <input className="input" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} maxLength={2} required />
          </label>
          <label className="grid" style={{ gap: 8 }}>
            <span>Catégorie publique du badge</span>
            <select className="input" value={publicCategory} onChange={(event) => setPublicCategory(event.target.value)}>
              {['PERSON', 'CREATOR', 'JOURNALIST', 'ARTIST', 'ATHLETE', 'BUSINESS', 'ORGANIZATION', 'PUBLIC_FIGURE'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid" style={{ gap: 8 }}>
            <span>Pourquoi ce compte doit-il être certifié ?</span>
            <textarea className="input" value={publicReason} onChange={(event) => setPublicReason(event.target.value)} maxLength={500} rows={4} />
          </label>
          <p style={{ color: 'var(--muted)' }}>Documents requis : {requiredKinds.map((kind) => DOCUMENT_LABELS[kind]).join(' et ')}.</p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>J’accepte que les documents soient consultés uniquement par les examinateurs autorisés pour cette demande.</span>
          </label>
          <button className="btn btn-primary" disabled={busy || !termsAccepted}>Créer la demande</button>
        </form>
      )}

      {request && (
        <section className="grid" style={{ marginTop: 24 }}>
          <article className="card" style={{ padding: 24 }}>
            <small style={{ color: 'var(--orange)' }}>{STATUS_LABELS[request.status] ?? request.status}</small>
            <h2>Dernière demande</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Référence : {request.id}</p>
            <p>{request.subjectType} · {request.publicCategory} · {request.countryCode}</p>
            {request.publicReason && <p>{request.publicReason}</p>}
            <p style={{ color: 'var(--muted)' }}>Créée le {new Date(request.createdAt).toLocaleString('fr-FR')}</p>
          </article>

          {canEdit && (
            <form className="card grid" onSubmit={uploadDocument} style={{ padding: 24 }}>
              <h2>Documents privés</h2>
              <select className="input" value={documentKind} onChange={(event) => setDocumentKind(event.target.value)}>
                {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
              />
              <small style={{ color: 'var(--muted)' }}>JPEG, PNG ou PDF · 10 Mo maximum · jamais publié sur le profil.</small>
              <button className="btn" disabled={busy || !file}>Ajouter le document</button>
            </form>
          )}

          <article className="card" style={{ padding: 24 }}>
            <h2>Documents ajoutés</h2>
            <div className="grid">
              {request.documents.map((document) => (
                <div key={document.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{DOCUMENT_LABELS[document.kind] ?? document.kind}</strong>
                    <div style={{ color: 'var(--muted)' }}>{Math.ceil(document.sizeBytes / 1024)} Ko · {document.mimeType}</div>
                  </div>
                  {canEdit && <button className="btn" disabled={busy} onClick={() => void removeDocument(document.id)}>Retirer</button>}
                </div>
              ))}
              {!request.documents.length && <p style={{ color: 'var(--muted)' }}>Aucun document ajouté.</p>}
            </div>
          </article>

          {request.decisions.length > 0 && (
            <article className="card" style={{ padding: 24 }}>
              <h2>Décisions et demandes de précisions</h2>
              <div className="grid">
                {request.decisions.map((decision) => (
                  <div key={decision.id}>
                    <strong>{decision.action}</strong>
                    <div style={{ color: 'var(--muted)' }}>{new Date(decision.createdAt).toLocaleString('fr-FR')} · {decision.reasonCode}</div>
                    {decision.userMessage && <p>{decision.userMessage}</p>}
                  </div>
                ))}
              </div>
            </article>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {canEdit && <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>Envoyer pour examen</button>}
            {canCancel && <button className="btn" disabled={busy} onClick={() => void cancel()}>Annuler la demande</button>}
          </div>
        </section>
      )}
    </main>
  );
}
