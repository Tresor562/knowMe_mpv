'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../../components/i18n-provider';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type Member = {
  userId: string;
  joinedAt?: string;
  user: { id: string; username: string; displayName: string; avatarUrl?: string | null };
};
type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  createdAt?: string;
  members: Member[];
};

function Avatar({ member, size = 'regular' }: { member: Member; size?: 'regular' | 'small' }) {
  const name = member.user.displayName || member.user.username;
  return <span className={`km-info-member-avatar${size === 'small' ? ' is-small' : ''}`}>
    {member.user.avatarUrl
      ? <img src={member.user.avatarUrl} alt="" loading="lazy" />
      : <span>{Array.from(name)[0]?.toLocaleUpperCase() || '?'}</span>}
  </span>;
}

export default function ConversationInfoPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (french: string, english: string) => en ? english : french;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'details'>('members');

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError('');
    try {
      // /conversations lists only chats belonging to the authenticated user.
      // No member list is exposed unless the viewer already belongs to it.
      const chats = await apiFetch<Conversation[]>('/conversations');
      const found = chats.find(chat => chat.id === id);
      if (!found) throw new Error(en
        ? 'This conversation cannot be found in your chats.'
        : 'Cette conversation est introuvable dans tes discussions.');
      setConversation(found);
    } catch (cause) {
      setConversation(null);
      setError(cause instanceof Error ? cause.message
        : tr('Impossible de charger cette discussion.', 'Unable to load this conversation.'));
    } finally { setLoading(false); }
  }, [id, user?.id, locale]);

  useEffect(() => { void load(); }, [load]);

  const visibleMembers = useMemo(() => {
    if (!conversation) return [];
    const term = query.trim().toLocaleLowerCase();
    return conversation.members.filter(member => {
      const name = `${member.user.displayName} ${member.user.username}`.toLocaleLowerCase();
      return name.includes(term);
    }).sort((a,b) => a.user.displayName.localeCompare(b.user.displayName, locale));
  }, [conversation, query, locale]);

  const isGroup = conversation?.isGroup ?? false;
  const members = conversation?.members ?? [];
  const other = members.find(member => member.userId !== user?.id);
  const title = conversation
    ? (conversation.title || (isGroup
      ? tr('Groupe sans nom', 'Untitled group')
      : other?.user.displayName || tr('Discussion privée', 'Private chat')))
    : '';

  async function shareConversation() {
    if (!conversation) return;
    const url = `${window.location.origin}/messages/${encodeURIComponent(conversation.id)}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; }
      catch (cause) { if ((cause as {name?: string})?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(tr('Le partage a échoué.','Sharing failed.'));
    }
  }

  return <main className="shell km-info-page">
    <header className="km-info-topbar">
      <Link href={`/messages/${encodeURIComponent(id)}`} className="km-info-back"
        aria-label={tr('Retour à la discussion', 'Back to chat')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <h1>{tr('Informations', 'Information')}</h1>
      <button type="button" className="km-info-refresh" onClick={() => void load()}
        disabled={loading} aria-label={tr('Actualiser','Refresh')}>
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none"
          strokeWidth="1.8" aria-hidden="true"><path d="M20 8v-5h-5M4 16v5h5"/><path d="M5 9a8 8 0 0 1 14-3l1 2M4 16l1 2a8 8 0 0 0 14-3"/></svg>
      </button>
    </header>
    {(sessionLoading || loading) && <p className="km-info-status" role="status">{tr('Chargement…','Loading…')}</p>}
    {error && <p className="km-auth-error" role="alert">{error}</p>}
    {!loading && !sessionLoading && conversation && <>
      <section className="km-info-identity" aria-label={tr('Identité de la discussion', 'Chat identity')}>
        {isGroup
          ? <div className="km-info-group-avatar" aria-hidden="true">
            {members.slice(0, 4).map(member =>
              <span key={member.userId}>
                {member.user.avatarUrl ? <img src={member.user.avatarUrl} alt="" /> :
                  (Array.from(member.user.displayName)[0] || '?').toLocaleUpperCase()}
              </span>)}
          </div>
          : other && <Avatar member={other} />}
        <h2>{title}</h2>
        <p>{isGroup
          ? `${members.length} ${tr('membres','members')}`
          : other ? `@${other.user.username}` : tr('Discussion privée','Private chat')}</p>
      </section>
      <nav className="km-info-actions" aria-label={tr('Actions de la discussion', 'Chat actions')}>
        <Link href={`/messages/${encodeURIComponent(id)}`}>
          <svg viewBox="0 0 24 24" width="23" height="23" stroke="currentColor" fill="none" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L4 20l1.3-4A8 8 0 1 1 20 11.5Z"/></svg>
          <span>{tr('Messages', 'Messages')}</span>
        </Link>
        <button type="button" onClick={() => void shareConversation()}>
          <svg viewBox="0 0 24 24" width="23" height="23" stroke="currentColor" fill="none" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 16V3m-5 5 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
          <span>{copied ? tr('Lien copié','Link copied') : tr('Partager', 'Share')}</span>
        </button>
        {!isGroup && other && <Link href={`/profile/${encodeURIComponent(other.user.username)}`}>
          <svg viewBox="0 0 24 24" width="23" height="23" stroke="currentColor" fill="none" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5"/><path d="M4.5 21c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"/></svg>
          <span>{tr('Profil', 'Profile')}</span>
        </Link>}
      </nav>
      <div className="km-info-tabs" role="tablist" aria-label={tr('Sections','Sections')}>
        <button type="button" role="tab" aria-selected={activeTab==='members'}
          onClick={() => setActiveTab('members')}>
          {isGroup ? tr('Membres','Members') : tr('Participants', 'Participants')}
        </button>
        <button type="button" role="tab" aria-selected={activeTab==='details'}
          onClick={() => setActiveTab('details')}>{tr('Détails','Details')}</button>
      </div>
      {activeTab === 'members' && <section className="km-info-members" role="tabpanel">
        {isGroup && <div className="km-info-search">
          <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" fill="none"
            strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder={tr('Rechercher un membre', 'Search members')}
            aria-label={tr('Rechercher un membre','Search members')} />
        </div>}
        {visibleMembers.length === 0
          ? <p className="km-info-status">{tr('Aucun membre correspondant.', 'No matching members.')}</p>
          : visibleMembers.map(member =>
            <Link className="km-info-member-row" href={`/profile/${encodeURIComponent(member.user.username)}`}
              key={member.userId}>
              <Avatar member={member} size="small"/>
              <span className="km-info-member-name">
                <strong>{member.user.displayName}{member.userId===user?.id ? ` ${tr('(vous)','(you)')}` : ''}</strong>
                <small>@{member.user.username}</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>)}
      </section>}
      {activeTab === 'details' && <section className="km-info-details" role="tabpanel">
        <dl>
          <div><dt>{tr('Type de discussion','Chat type')}</dt>
            <dd>{isGroup ? tr('Groupe', 'Group') : tr('Discussion privée','Private chat')}</dd></div>
          <div><dt>{tr('Participants','Participants')}</dt><dd>{members.length}</dd></div>
          {conversation.createdAt && <div><dt>{tr('Créé le','Created')}</dt>
            <dd>{new Date(conversation.createdAt).toLocaleDateString(locale==='en'?'en-US':'fr-FR',
              {year:'numeric',month:'long',day:'numeric'})}</dd></div>}
        </dl>
        <p className="km-info-hint">{isGroup
          ? tr('La gestion des administrateurs, des invitations et de la description sera disponible lorsque les permissions de groupe seront activées.',
             'Admin management, invitations, and descriptions will be available once group permissions are implemented.')
          : tr('Les informations du contact restent accessibles depuis son profil.',
             'Contact information is available on their profile.')}</p>
      </section>}
    </>}
  </main>;
}
