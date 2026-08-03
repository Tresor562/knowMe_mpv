'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';

type PublicSecretPage = {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  presentation: string;
  prompt: string;
  category: string;
  acceptedCategories: string[];
  allowUnauthenticatedSenders: boolean;
  challengeRequired: boolean;
  publicMessageCount: number | null;
  campaign: { token: string; expiresAt: string | null; remainingResponses: number | null } | null;
  entryPoint: string;
  anonymity: {
    identityVisibleToRecipient: false;
    premiumCanRevealIdentity: false;
    senderCanBeBlockedWithoutBeingIdentified: true;
  };
};

export default function PublicSecretPage() {
  const params = useParams<{ slug: string }>();
  const [queryState, setQueryState] = useState({ question: '', entry: 'SHARED_LINK', ready: false });
  const [page, setPage] = useState<PublicSecretPage | null>(null);
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const question = search.get('question') ?? '';
    setQueryState({
      question,
      entry: search.get('entry') ?? (question ? 'QUESTION_CARD' : 'SHARED_LINK'),
      ready: true
    });
  }, []);

  const load = useCallback(async () => {
    if (!queryState.ready) return;
    try {
      const query = new URLSearchParams();
      if (queryState.question) query.set('question', queryState.question);
      query.set('entry', queryState.entry);
      const data = await apiFetch<PublicSecretPage>(
        `/knowme-secret/public/${encodeURIComponent(params.slug)}?${query.toString()}`
      );
      setPage(data);
      setNotice('');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Cette page Secret est indisponible.');
    }
  }, [params.slug, queryState]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page) return;
    const form = new FormData(event.currentTarget);
    const content = String(form.get('content') ?? '').trim();
    const category = String(form.get('category') ?? page.category);
    if (!content) return;

    setSending(true);
    try {
      await apiFetch(`/knowme-secret/public/${encodeURIComponent(page.slug)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          category,
          campaignToken: page.campaign?.token,
          entryPoint: page.entryPoint
        })
      });
      event.currentTarget.reset();
      setSent(true);
      setNotice('Message envoyé anonymement. Ton identité n’est pas affichée au destinataire.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  }

  if (!page) {
    return <main className="shell" style={{ maxWidth: 620, margin: '0 auto' }}><section className="card" style={{ padding: 24 }}><p>{notice || 'Chargement…'}</p></section></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gap: 18 }}>
      <section className="card" style={{ padding: 28, textAlign: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top,rgba(69,230,189,.16),transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ width: 86, height: 86, borderRadius: '50%', margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--mint),var(--orange))', fontSize: 32, fontWeight: 900 }}>
            {page.displayName[0]?.toUpperCase()}
          </div>
          <small style={{ color: 'var(--mint)' }}>🕵️ KNOWME SECRET</small>
          <h1>{page.displayName}</h1>
          <p style={{ color: 'var(--muted)' }}>{page.presentation}</p>
          {page.publicMessageCount !== null && <small>{page.publicMessageCount} message(s) reçu(s)</small>}
        </div>
      </section>

      <form className="card" style={{ padding: 24, display: 'grid', gap: 14 }} onSubmit={submit}>
        <div>
          <small style={{ color: 'var(--mint)' }}>{page.campaign ? 'QUESTION PARTAGÉE' : 'MESSAGE ANONYME'}</small>
          <h2>{page.prompt}</h2>
          {page.campaign?.remainingResponses !== null && page.campaign?.remainingResponses !== undefined && (
            <p style={{ color: 'var(--muted)' }}>{page.campaign.remainingResponses} réponse(s) encore acceptée(s)</p>
          )}
        </div>
        {page.acceptedCategories.length > 1 && (
          <select className="input" name="category" defaultValue={page.category}>
            {page.acceptedCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        )}
        <textarea className="input" name="content" required maxLength={2000} rows={7} placeholder="Écris ici…" />
        <button className="btn btn-primary" disabled={sending || page.challengeRequired}>
          {sending ? 'Envoi…' : 'Envoyer anonymement'}
        </button>
        {page.challengeRequired && (
          <p role="alert" style={{ color: 'var(--orange)' }}>
            Cette page exige une vérification anti-robot. Le fournisseur de vérification doit être configuré avant l’envoi Web.
          </p>
        )}
        <small style={{ color: 'var(--muted)' }}>
          Le destinataire ne voit ni ton identité ni ton profil. Il peut toutefois bloquer anonymement les abus et signaler un message.
        </small>
      </form>

      {notice && <section className="card" style={{ padding: 16 }} role="status"><p>{notice}</p>{sent && <button className="btn" onClick={() => { setSent(false); setNotice(''); }}>Envoyer un autre message</button>}</section>}

      <section className="card" style={{ padding: 18 }}>
        <h3>Comment ça marche ?</h3>
        <p style={{ color: 'var(--muted)' }}>
          Cette personne a activé KnowMe Secret puis partagé ce lien, ou autorisé l’envoi depuis son profil. Les réponses arrivent dans une boîte séparée de sa messagerie normale.
        </p>
      </section>
    </main>
  );
}
