'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Friend = {
  user: { id: string; displayName: string; username: string; avatarUrl?: string | null };
};
type NewConversation = { id: string };

export default function NewMessagePage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const router = useRouter();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'message' | 'group' | 'details'>('message');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user || sessionLoading) return;
    let active = true;
    setLoading(true);
    void apiFetch<Friend[]>('/social/friends').then(value => {
      if (!active) return;
      setFriends(value);
      setError('');
    }).catch(() => {
      if (active) setError(en
        ? 'Your contacts could not be loaded. Try again.'
        : 'Chargement des contacts impossible. Réessaie.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, sessionLoading]);

  const visible = useMemo(() => friends
    .filter(({user:friend}) =>
      `${friend.displayName} ${friend.username}`.toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()))
    .sort((a,b)=>a.user.displayName.localeCompare(b.user.displayName,locale)),
    [friends, query, locale]
  );

  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create(memberIds: string[], title?: string) {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const chat = await apiFetch<NewConversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ memberIds, ...(title ? { title } : {}) })
      });
      router.push(`/messages/${encodeURIComponent(chat.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message :
        tr('Impossible de créer cette discussion.','Could not create this chat.'));
    } finally {
      setCreating(false);
    }
  }

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = groupName.trim();
    if (title.length === 0 || selected.size < 2) return;
    void create([...selected], title);
  }

  function goBack() {
    if (mode === 'details') setMode('group');
    else if (mode === 'group') { setMode('message'); setSelected(new Set()); setQuery(''); }
    else router.push('/messages');
  }

  if (sessionLoading || !user) return <main className="shell km-new-chat-page">
    <p role="status">{tr('Chargement…','Loading…')}</p>
  </main>;

  return <main className="shell km-new-chat-page">
    <header className="km-new-chat-header">
      <button className="km-new-chat-back" type="button"
        onClick={goBack} aria-label={tr('Retour','Back')}>
        <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </button>
      <div>
        <h1>{mode === 'message' ? tr('Nouveau message','New message')
          : mode === 'group' ? tr('Nouveau groupe','New group')
          : tr('Créer le groupe','Create group')}</h1>
        <p>{mode === 'group' ? tr(`${selected.size} contact(s) sélectionné(s)`, `${selected.size} selected`)
          : mode === 'details' ? tr('Nom et membres du groupe','Group name and members')
          : tr('Choisis une personne pour discuter','Choose someone to message')}</p>
      </div>
    </header>

    {error && <p className="km-auth-error" role="alert">{error}</p>}

    {mode !== 'details' ? <>
      <div className="km-new-chat-search">
        <svg width="21" height="21" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.9" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></svg>
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
          aria-label={tr('Rechercher des contacts','Search contacts')}
          placeholder={tr('Rechercher des contacts','Search contacts')}/>
      </div>

      {mode === 'message' && <button type="button" className="km-new-chat-option" onClick={() => {
        setMode('group');setSelected(new Set());setQuery('');setError('');
      }}>
        <span className="km-new-chat-option-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.8" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-4 2-6 6-6s6 2 6 6"/><path d="M17 7a3 3 0 0 1 0 6m1 1c2.5.5 3.5 2 3.5 5"/></svg>
        </span>
        {tr('Nouveau groupe','New group')}
        <span aria-hidden="true" className="km-new-chat-chevron">›</span>
      </button>}

      <h2 className="km-new-chat-section">{tr('Contacts','Contacts')}</h2>
      {loading && <p className="km-new-chat-empty" role="status">{tr('Chargement des contacts…','Loading contacts…')}</p>}
      {!loading && visible.length === 0 && <div className="km-new-chat-empty">
        <p>{query ? tr('Aucun contact correspondant.','No matching contacts.')
          : tr('Retrouve tes contacts et tes amis depuis KnowMe.','Find friends and contacts on KnowMe.')}</p>
        <Link href="/friends">{tr('Voir mes amis','Find friends')} →</Link>
      </div>}
      <div className="km-new-chat-contacts" role={mode==='group' ? 'group' : undefined}
        aria-label={tr('Liste des contacts','Contact list')}>
        {visible.map(({user:friend}) => {
          const checked = selected.has(friend.id);
          return <button key={friend.id} type="button" className="km-new-chat-contact" disabled={creating}
            role={mode==='group'?'checkbox':undefined} aria-checked={mode==='group'?checked:undefined}
            onClick={() => { if(mode==='group')toggle(friend.id);else void create([friend.id]); }}>
            <span className="km-new-chat-avatar">
              {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" />
                : (Array.from(friend.displayName)[0]||'?').toUpperCase()}
            </span>
            <span className="km-new-chat-name">
              <strong>{friend.displayName}</strong><small>@{friend.username}</small>
            </span>
            {mode === 'group' && <span className={`km-new-chat-select${checked?' selected':''}`} aria-hidden="true">
              {checked ? '✓' : ''}
            </span>}
          </button>;
        })}
      </div>
      {mode==='group'&&<button type="button" className="km-new-chat-next"
        disabled={selected.size<2||creating}
        onClick={()=>{setMode('details');setError('');}}>
        {tr('Continuer','Continue')} ({selected.size})
        <svg width="21" height="21" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </button>}
    </> : <form className="km-new-chat-details" onSubmit={submitGroup}>
      <label htmlFor="km-group-name">{tr('Nom du groupe','Group name')}</label>
      <input id="km-group-name" autoFocus minLength={1} maxLength={90}
        value={groupName} onChange={e=>setGroupName(e.target.value)}
        placeholder={tr('Nom du groupe','Group name')} required />
      <p>{tr('Les personnes sélectionnées rejoindront ce groupe.', 'The selected contacts will join this group.')}</p>
      <div className="km-new-chat-members">
        {friends.filter(f=>selected.has(f.user.id)).map(({user:friend})=>
          <span key={friend.id}>{friend.displayName}</span>)}
      </div>
      <button type="submit" className="km-new-chat-create" disabled={creating||!groupName.trim()||selected.size<2}>
        {creating ? tr('Création…','Creating…') : tr('Créer le groupe','Create group')}
      </button>
    </form>}
  </main>;
}
