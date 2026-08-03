'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type SecretCampaign = {
  id: string;
  prompt: string;
  category: string;
  status: string;
  messageCount: number;
  shareCount: number;
  expiresAt: string | null;
  links: { public: string; canonical: string; deepLink: string };
};

type SecretPage = {
  id: string;
  slug: string;
  displayName: string;
  presentation: string;
  defaultPrompt: string;
  enabled: boolean;
  profileEntryEnabled: boolean;
  allowUnauthenticatedSenders: boolean;
  requireChallengeVerification: boolean;
  publicMessageCountVisible: boolean;
  pausedUntil: string | null;
  acceptedCategories: string[];
  blockedTerms: string[];
  links: { public: string; canonical: string; deepLink: string; profileEntry: string };
  campaigns: SecretCampaign[];
  inbox: { total: number; unread: number };
};

type SecretMessage = {
  id: string;
  category: string;
  content: string;
  status: string;
  openedAt: string | null;
  createdAt: string;
  campaign?: { prompt: string; token: string } | null;
  reply?: { answer: string; visibility: string } | null;
};

export default function SecretOwnerPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [page, setPage] = useState<SecretPage | null>(null);
  const [messages, setMessages] = useState<SecretMessage[]>([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pageData, inboxData] = await Promise.all([
        apiFetch<SecretPage>('/knowme-secret/me'),
        apiFetch<SecretMessage[]>('/knowme-secret/me/inbox')
      ]);
      setPage(pageData);
      setMessages(inboxData);
      setNotice('');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'KnowMe Secret est indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    try {
      await apiFetch('/knowme-secret/me', {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prompt = String(form.get('prompt') ?? '').trim();
    const category = String(form.get('category') ?? 'QUESTION');
    const duration = Number(form.get('durationHours') ?? 24);
    if (!prompt) return;

    setSaving(true);
    try {
      const campaign = await apiFetch<SecretCampaign>('/knowme-secret/me/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          category,
          source: 'QUESTION_CARD',
          expiresAt: new Date(Date.now() + duration * 60 * 60 * 1_000).toISOString()
        })
      });
      event.currentTarget.reset();
      await shareLink(campaign.links.canonical, prompt);
      await apiFetch(`/knowme-secret/me/campaigns/${campaign.id}/share`, { method: 'POST' });
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Question impossible à créer.');
    } finally {
      setSaving(false);
    }
  }

  async function shareLink(link: string, text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'KnowMe Secret', text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setNotice('Lien copié. Tu peux le publier dans un statut, une Story ou une autre application.');
    } catch {
      setNotice(`Lien prêt à partager : ${link}`);
    }
  }

  async function messageAction(id: string, action: 'open' | 'archive' | 'block-sender') {
    try {
      await apiFetch(`/knowme-secret/me/inbox/${id}/${action}`, {
        method: action === 'open' || action === 'archive' ? 'PATCH' : 'POST'
      });
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Action impossible.');
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answer = String(form.get('answer') ?? '').trim();
    if (!answer) return;
    try {
      await apiFetch(`/knowme-secret/me/inbox/${messageId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ answer, visibility: 'PUBLIC' })
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Réponse impossible.');
    }
  }

  if (sessionLoading || !user || !page) {
    return <main className="shell"><p>{notice || 'Chargement de KnowMe Secret…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 20 }}>
      <header className="card" style={{ padding: 24 }}>
        <small style={{ color: 'var(--mint)' }}>🕵️ APPLICATION INTÉGRÉE SÉPARÉE</small>
        <h1>KnowMe Secret</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
          Active ta page, pose une question puis partage son lien. Toute personne ayant accès au lien peut répondre anonymement selon tes réglages de sécurité.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={saving} onClick={() => void patch({ enabled: !page.enabled })}>
            {page.enabled ? 'Désactiver la réception' : 'Activer ma page Secret'}
          </button>
          {page.enabled && (
            <button className="btn" onClick={() => void shareLink(page.links.canonical, page.defaultPrompt)}>
              Partager mon lien général
            </button>
          )}
        </div>
      </header>

      {notice && <p role="status" className="card" style={{ padding: 14 }}>{notice}</p>}

      <section className="card" style={{ padding: 22 }}>
        <h2>Visibilité et mode d’emploi</h2>
        <p style={{ color: 'var(--muted)' }}>
          État : <strong>{page.enabled ? 'réception active' : 'désactivée'}</strong> ·
          Depuis le profil : <strong>{page.profileEntryEnabled ? 'autorisé' : 'masqué'}</strong> ·
          Boîte : <strong>{page.inbox.unread} non lu(s)</strong>
        </p>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={page.profileEntryEnabled}
            onChange={(event) => void patch({ profileEntryEnabled: event.target.checked })}
          />
          Afficher « Envoyer un message anonyme » sur mon profil public
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <input
            type="checkbox"
            checked={page.allowUnauthenticatedSenders}
            onChange={(event) => void patch({ allowUnauthenticatedSenders: event.target.checked })}
          />
          Autoriser les visiteurs sans compte KnowMe
        </label>
        <p style={{ marginTop: 14 }}><strong>Lien :</strong> {page.links.canonical}</p>
      </section>

      <form className="card" style={{ padding: 22, display: 'grid', gap: 12 }} onSubmit={createQuestion}>
        <div>
          <small style={{ color: 'var(--mint)' }}>QUESTION PARTAGEABLE</small>
          <h2>Pose une question</h2>
          <p style={{ color: 'var(--muted)' }}>Chaque question obtient un lien indépendant, une expiration et son propre compteur de réponses.</p>
        </div>
        <input className="input" name="prompt" maxLength={180} required placeholder="Ex. Quelle est la première impression que je donne ?" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select className="input" name="category" defaultValue="QUESTION">
            <option value="QUESTION">Question</option>
            <option value="COMPLIMENT">Compliment</option>
            <option value="CONFESSION">Confession</option>
            <option value="FEEDBACK">Avis</option>
          </select>
          <select className="input" name="durationHours" defaultValue="24">
            <option value="1">1 heure</option>
            <option value="6">6 heures</option>
            <option value="12">12 heures</option>
            <option value="24">24 heures</option>
            <option value="72">72 heures</option>
            <option value="168">7 jours</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={saving || !page.enabled}>Créer et partager</button>
      </form>

      <section className="card" style={{ padding: 22 }}>
        <h2>Questions actives</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {page.campaigns.map((campaign) => (
            <article key={campaign.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <strong>{campaign.prompt}</strong>
              <p style={{ color: 'var(--muted)' }}>{campaign.messageCount} réponse(s) · {campaign.shareCount} partage(s) · {campaign.status}</p>
              <button className="btn" onClick={() => void shareLink(campaign.links.canonical, campaign.prompt)}>Partager de nouveau</button>
            </article>
          ))}
          {!page.campaigns.length && <p style={{ color: 'var(--muted)' }}>Aucune question partagée pour le moment.</p>}
        </div>
      </section>

      <section className="card" style={{ padding: 22 }}>
        <h2>Boîte anonyme</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {messages.map((message) => (
            <article key={message.id} style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 16, opacity: message.status === 'ARCHIVED' ? 0.65 : 1 }}>
              <small style={{ color: 'var(--mint)' }}>{message.category} · {new Date(message.createdAt).toLocaleString('fr-FR')}</small>
              {message.campaign?.prompt && <p style={{ color: 'var(--muted)' }}>Réponse à : {message.campaign.prompt}</p>}
              <p style={{ fontSize: 17 }}>{message.content}</p>
              {message.reply ? (
                <p><strong>Ta réponse :</strong> {message.reply.answer}</p>
              ) : (
                <form onSubmit={(event) => void reply(event, message.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="input" name="answer" required placeholder="Répondre et créer une carte partageable" style={{ flex: 1 }} />
                  <button className="btn btn-primary">Répondre</button>
                </form>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {!message.openedAt && <button className="btn" onClick={() => void messageAction(message.id, 'open')}>Marquer comme lu</button>}
                <button className="btn" onClick={() => void messageAction(message.id, 'archive')}>Archiver</button>
                <button className="btn" onClick={() => void messageAction(message.id, 'block-sender')}>Bloquer cet expéditeur anonyme</button>
              </div>
            </article>
          ))}
          {!messages.length && <p style={{ color: 'var(--muted)' }}>Les réponses reçues apparaîtront ici.</p>}
        </div>
      </section>
    </main>
  );
}
