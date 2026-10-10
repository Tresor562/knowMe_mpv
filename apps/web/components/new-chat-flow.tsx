'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/use-session';
import { useI18n } from './i18n-provider';

type Friend = {
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
};

function ContactPhoto({ friend }: { friend: Friend['user'] }) {
  return <span className="km-new-chat-avatar">
    {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" loading="lazy"/> :
      <span>{friend.displayName.trim().slice(0, 1).toUpperCase() || '?'}</span>}
  </span>;
}

export function NewChatFlow({ mode }: { mode: 'private' | 'group' }) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<'contacts' | 'details'>('contacts');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionLoading || !user) return;
    let active = true;
    setLoading(true);
    void apiFetch<Friend[]>('/social/friends').then(rows => {
      if (active) { setFriends(rows); setError(''); }
    }).catch(() => {
      if (active) setError(tr('Impossible de charger les contacts. Réessaie.', 'Could not load contacts. Please retry.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionLoading, user?.id, locale]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return friends.filter(({ user: friend }) => [friend.displayName, friend.username]
      .some(text => text.toLocaleLowerCase().includes(query)))
      .sort((a,b) => a.user.displayName.localeCompare(b.user.displayName, en?'en':'fr'));
  }, [friends, search, en]);

  const selectedFriends = useMemo(() => selected.map(id => friends.find(row => row.user.id === id)?.user).filter((item): item is Friend['user'] => Boolean(item)), [friends, selected]);

  async function create(ids: string[], name?: string) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      // Opening an existing private conversation should never create a duplicate.
      if (mode === 'private' && ids.length === 1) {
        const existing = await apiFetch<Array<{
          id: string;
          isGroup: boolean;
          members: Array<{userId: string}>;
        }>>('/conversations');
        const known = existing.find(row => !row.isGroup && row.members.length === 2 &&
          row.members.some(member => member.userId === ids[0]) &&
          row.members.some(member => member.userId === user?.id));
        if (known) {
          router.replace(`/messages/${encodeURIComponent(known.id)}`);
          return;
        }
      }
      const conversation = await apiFetch<{id:string}>('/conversations',{
        method: 'POST', body: JSON.stringify({ memberIds: ids, ...(name ? {title:name} : {}) })
      });
      router.replace(`/messages/${encodeURIComponent(conversation.id)}`);
    } catch {
      setError(tr('Impossible de créer la discussion. Vérifie les contacts sélectionnés et réessaie.',
        'Could not create the chat. Check your selected contacts and try again.'));
      setSaving(false);
    }
  }

  function selectFriend(id:string) {
    if (mode === 'private') { void create([id]); return; }
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  function startGroup() {
    if (selected.length < 2) {
      setError(tr('Sélectionne au moins deux personnes pour créer un groupe.',
        'Choose at least two people to create a group.'));
      return;
    }
    setError('');
    setStep('details');
  }

  function submitGroup(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = title.trim();
    if (name.length < 2) {
      setError(tr('Donne un nom de deux caractères minimum à ton groupe.',
        'Choose a group name of at least two characters.'));
      return;
    }
    if (selected.length < 2) {
      setStep('contacts');
      setError(tr('Sélectionne au moins deux personnes.', 'Select at least two people.'));
      return;
    }
    void create(selected, name);
  }

  if (sessionLoading || !user) return <main className="km-new-chat-page"><p>{tr('Chargement…','Loading…')}</p></main>;

  const details = mode === 'group' && step === 'details';
  const back = details ? () => setStep('contacts') : null;

  return <main className="km-new-chat-page">
    <header className="km-new-chat-header">
      {back
        ? <button type="button" className="km-native-back" onClick={back} aria-label={tr('Retour aux contacts','Back to contacts')}>
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
          </button>
        : <Link href={mode === 'group' ? '/messages/new' : '/messages'} className="km-native-back" aria-label={tr('Retour','Back')}>
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
          </Link>}
      <div><h1>{mode === 'private' ? tr('Nouveau message','New message') : details
        ? tr('Créer le groupe','Create group') : tr('Nouveau groupe','New group')}</h1>
        {mode === 'group' && <p>{details
          ? tr(`${selected.length} contacts sélectionnés`, `${selected.length} selected contacts`)
          : tr('Sélectionne les participants','Select participants')}</p>}
      </div>
      {mode === 'group' && !details && <button type="button" className="km-new-chat-next"
        disabled={selected.length < 2 || saving} onClick={startGroup} aria-label={tr('Continuer','Continue')}>
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12h14m-6-6 6 6-6 6"/></svg>
      </button>}
    </header>

    {!details && <>
      <div className="km-new-chat-search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
        </svg>
        <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
          placeholder={tr('Rechercher des contacts','Search contacts')}
          aria-label={tr('Rechercher des contacts','Search contacts')}/>
      </div>
      {mode === 'private' && <nav className="km-new-chat-actions" aria-label={tr('Créer une discussion','Create chat')}>
        <Link href="/messages/new/group">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="8.5" cy="9" r="3.5"/><path d="M2.5 20v-1c0-3.2 2.3-5 6-5s6 1.8 6 5v1"/><path d="M16 7a3.5 3.5 0 0 1 0 7m3 6v-1c0-2-1-3.5-3-4"/>
          </svg>
          <span>{tr('Nouveau groupe','New group')}</span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link href="/friends">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="8" r="4"/><path d="M4 21c0-4 2.5-6 7-6s7 2 7 6"/><path d="M19 5v6m-3-3h6"/>
          </svg>
          <span>{tr('Ajouter des contacts','Add contacts')}</span>
          <span aria-hidden="true">›</span>
        </Link>
      </nav>}
      {mode === 'group' && selectedFriends.length>0 && <section className="km-new-chat-selected" aria-label={tr('Participants sélectionnés','Selected participants')}>
        {selectedFriends.map(friend => <button type="button" key={friend.id}
          title={tr('Retirer','Remove')+' '+friend.displayName} onClick={()=>selectFriend(friend.id)}>
          <ContactPhoto friend={friend}/><span>{friend.displayName}</span><strong aria-hidden="true">×</strong>
        </button>)}
      </section>}
      <section className="km-new-chat-list" aria-label={tr('Liste des contacts','Contact list')}>
        <h2>{tr('Contacts','Contacts')}{friends.length ? ` · ${friends.length}` : ''}</h2>
        {loading && <p role="status" className="km-new-chat-info">{tr('Chargement des contacts…','Loading contacts…')}</p>}
        {!loading && filtered.length === 0 && <div className="km-new-chat-empty">
          <p>{friends.length
            ? tr('Aucun contact trouvé.','No matching contacts.')
            : tr('Tu n’as pas encore de contacts. Ajoute des amis pour commencer.',
                'You do not have contacts yet. Add friends to get started.')}</p>
          {!friends.length && <Link href="/friends">{tr('Trouver des amis','Find friends')} →</Link>}
        </div>}
        {filtered.map(({user:friend}) => {
          const checked = selected.includes(friend.id);
          return <button key={friend.id} type="button" className="km-new-chat-person"
            onClick={()=>selectFriend(friend.id)} disabled={saving}
            aria-pressed={mode === 'group' ? checked : undefined}>
            <ContactPhoto friend={friend}/>
            <span className="km-new-chat-person-info"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span>
            {mode === 'group' && <span className={`km-new-chat-check${checked?' checked':''}`} aria-hidden="true">
              {checked ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="m5 12 5 5L20 7"/></svg> : null}
            </span>}
          </button>;
        })}
      </section>
    </>}

    {details && <form className="km-new-group-details" onSubmit={submitGroup}>
      <div className="km-new-group-photo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="35" height="35" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="3.5"/><path d="M2 20v-1c0-3.4 2.6-5 7-5s7 1.6 7 5v1M17 7a3.5 3.5 0 0 1 0 7M20 20v-1c0-2.4-.7-3.5-3-4"/></svg>
      </div>
      <label>{tr('Nom du groupe','Group name')}
        <input className="input" autoFocus required maxLength={80} minLength={2} value={title}
          onChange={event=>setTitle(event.target.value)} placeholder={tr('Donne un nom à ton groupe','Name your group')}/>
      </label>
      <p>{tr('Les participants pourront discuter ensemble dans KnowMe.','Participants will be able to chat together on KnowMe.')}</p>
      <button className="km-new-group-submit" disabled={saving || title.trim().length<2} type="submit">
        {saving ? tr('Création…','Creating…') : tr('Créer le groupe','Create group')}
      </button>
    </form>}
    {error && <p role="alert" className="km-new-chat-error">{error}</p>}
    {mode === 'group' && !details && <div className="km-new-chat-bottom">
      <button type="button" disabled={selected.length<2 || saving} onClick={startGroup}>
        {tr(`Continuer · ${selected.length}`,`Continue · ${selected.length}`)}
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 12h14m-6-6 6 6-6 6"/></svg>
      </button>
    </div>}
  </main>;
}
