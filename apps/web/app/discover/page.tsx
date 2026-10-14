'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useI18n } from '../../components/i18n-provider';
import { AccountBadges, AccountBadgeSet } from '../../components/AccountBadges';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Person = AccountBadgeSet & {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};
type Incoming = { id: string; requester: Person };

export default function DiscoverPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !user) return;
    let active = true;
    setLoading(true);
    apiFetch<Incoming[]>('/social/friend-requests/incoming')
      .then(data => { if (active) setIncoming(data); })
      .catch(cause => { if (active) setMessage(cause instanceof Error ? cause.message : (en ? 'Invitations unavailable.' : 'Invitations indisponibles.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionLoading, user?.id, en]);

  async function searchPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setBusy('search');
    setMessage('');
    try {
      setPeople(await apiFetch<Person[]>('/social/search?q=' + encodeURIComponent(value)));
    } catch (cause) {
      setPeople([]);
      setMessage(cause instanceof Error ? cause.message : (en ? 'Search unavailable.' : 'Recherche indisponible.'));
    } finally { setBusy(null); }
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    setBusy(requestId);
    setMessage('');
    try {
      await apiFetch('/social/friend-requests/' + encodeURIComponent(requestId) + '/' + action, { method: 'PATCH' });
      setIncoming(current => current.filter(item => item.id !== requestId));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : (en ? 'Could not respond.' : 'Impossible de répondre.'));
    } finally { setBusy(null); }
  }

  if (sessionLoading || !user) return <main className="shell"><p>{en ? 'Loading…' : 'Chargement…'}</p></main>;
  return (
    <main className="shell km-discover-native">
      <header className="km-discover-header">
        <div>
          <h1>{en ? 'Discover' : 'Suggestions'}</h1>
          <p>{en ? 'People, invitations and public communities' : 'Personnes, invitations et communautés publiques'}</p>
        </div>
        <Link href="/search" aria-label={en ? 'Global search' : 'Recherche globale'}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="7.2"/><path d="m16.4 16.4 5 5"/>
          </svg>
        </Link>
      </header>
      <form className="km-discover-search" onSubmit={searchPeople}>
        <input aria-label={en ? 'Search people' : 'Rechercher des personnes'} value={query}
          onChange={event => setQuery(event.target.value)} minLength={2}
          placeholder={en ? 'Name or username' : 'Nom ou pseudo'} required/>
        <button type="submit" disabled={busy === 'search'}>{en ? 'Search' : 'Rechercher'}</button>
      </form>
      {message && <p role="status" className="km-profile-notice">{message}</p>}
      <section className="km-discover-section">
        <h2>{en ? 'Invitations received' : 'Invitations reçues'}</h2>
        {loading ? <p>{en ? 'Loading invitations…' : 'Chargement des invitations…'}</p> :
          incoming.length ? incoming.map(item =>
            <article className="km-discover-person" key={item.id}>
              {item.requester.avatarUrl ? <img src={item.requester.avatarUrl} alt=""/> : <span className="km-discover-person-letter">{item.requester.displayName.slice(0,1)}</span>}
              <div className="km-discover-person-info">
                <strong>{item.requester.displayName}</strong>
                <AccountBadges staff={item.requester.staff} verification={item.requester.verification} compact/>
                <small>@{item.requester.username}</small>
              </div>
              <div className="km-discover-person-actions">
                <button type="button" disabled={busy === item.id} onClick={() => void respond(item.id, 'accept')}>{en ? 'Accept' : 'Accepter'}</button>
                <button type="button" disabled={busy === item.id} onClick={() => void respond(item.id, 'decline')}>{en ? 'Decline' : 'Refuser'}</button>
              </div>
            </article>
          ) : <p className="km-discover-muted">{en ? 'No pending invitations.' : 'Aucune invitation en attente.'}</p>}
      </section>
      {people.length > 0 && <section className="km-discover-section">
        <h2>{en ? 'People found' : 'Personnes trouvées'}</h2>
        {people.map(person => <Link className="km-discover-person" key={person.id} href={'/profile/' + encodeURIComponent(person.username)}>
          {person.avatarUrl ? <img src={person.avatarUrl} alt=""/> : <span className="km-discover-person-letter">{person.displayName.slice(0,1)}</span>}
          <div className="km-discover-person-info"><strong>{person.displayName}</strong>
            <AccountBadges staff={person.staff} verification={person.verification} compact/>
            <small>@{person.username}</small></div>
          <span aria-hidden="true">›</span>
        </Link>)}
      </section>}
      <section className="km-discover-section">
        <h2>{en ? 'Explore communities' : 'Explorer les communautés'}</h2>
        <div className="km-discover-links">
          <Link href="/friends"><span>{en ? 'Friends and requests' : 'Amis et demandes'}</span><span aria-hidden="true">›</span></Link>
          <Link href="/channels"><span>{en ? 'Public channels' : 'Chaînes publiques'}</span><span aria-hidden="true">›</span></Link>
          <Link href="/circles"><span>{en ? 'Groups and circles' : 'Groupes et cercles'}</span><span aria-hidden="true">›</span></Link>
        </div>
        <p className="km-discover-muted">{en
          ? 'Interest-ranked recommendations will appear here once the server provides verified matching results.'
          : 'Les recommandations personnalisées apparaîtront ici lorsque le serveur fournira des résultats de correspondance vérifiés.'}</p>
      </section>
    </main>
  );
}
