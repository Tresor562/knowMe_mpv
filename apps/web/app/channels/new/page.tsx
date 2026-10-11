'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Channel = { id: string };

export default function NewChannelPage(){
  const {user,loading}=useSession({required:true});
  const {locale}=useI18n();
  const en=locale==='en';
  const tr=(fr:string,english:string)=>en?english:fr;
  const router=useRouter();
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [username,setUsername]=useState('');
  const [visibility,setVisibility]=useState<'PUBLIC'|'PRIVATE'>('PUBLIC');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(saving||!name.trim())return;
    setSaving(true);setError('');
    try{
      const channel=await apiFetch<Channel>('/channels',{method:'POST',body:JSON.stringify({
        name:name.trim(),description:description.trim(),visibility,
        ...(visibility==='PUBLIC'&&username.trim()?{username:username.trim().replace(/^@/,'')}: {})
      })});
      router.replace(`/channels/${encodeURIComponent(channel.id)}`);
    }catch(cause){
      setError(cause instanceof Error?cause.message:tr('Création impossible.','Could not create channel.'));
    }finally{setSaving(false);}
  }
  if(loading||!user)return <main className="shell km-channels-page">{tr('Chargement…','Loading…')}</main>;
  return <main className="shell km-channels-page">
    <header className="km-channels-header">
      <Link href="/channels" className="km-channel-icon-action" aria-label={tr('Retour','Back')}>
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <h1>{tr('Nouvelle chaîne','New channel')}</h1>
    </header>
    <form onSubmit={create} className="km-channel-form">
      {error&&<p role="alert" className="km-auth-error">{error}</p>}
      <label htmlFor="new-channel-name">{tr('Nom de la chaîne','Channel name')}</label>
      <input id="new-channel-name" minLength={1} maxLength={72} required autoFocus
        value={name} onChange={event=>setName(event.target.value)}
        placeholder={tr('Ex. Actualités KnowMe','E.g. KnowMe News')}/>
      <label htmlFor="new-channel-description">{tr('Description (facultatif)','Description (optional)')}</label>
      <textarea id="new-channel-description" rows={3} maxLength={512} value={description}
        onChange={event=>setDescription(event.target.value)}
        placeholder={tr('De quoi parle cette chaîne ?','What is this channel about?')}/>
      <fieldset className="km-channel-visibility">
        <legend>{tr('Visibilité','Visibility')}</legend>
        <label className={visibility==='PUBLIC'?'selected':''}>
          <input type="radio" name="visibility" checked={visibility==='PUBLIC'} onChange={()=>setVisibility('PUBLIC')}/>
          <span><strong>{tr('Publique','Public')}</strong>
            <small>{tr('Visible dans la découverte et accessible à tous les utilisateurs KnowMe.',
              'Discoverable and accessible to all KnowMe users.')}</small></span>
        </label>
        <label className={visibility==='PRIVATE'?'selected':''}>
          <input type="radio" name="visibility" checked={visibility==='PRIVATE'} onChange={()=>setVisibility('PRIVATE')}/>
          <span><strong>{tr('Privée','Private')}</strong>
            <small>{tr('Visible uniquement par toi et les membres autorisés. Les invitations seront proposées ultérieurement.',
              'Visible only to you and authorized members. Invite management will be added later.')}</small></span>
        </label>
      </fieldset>
      {visibility==='PUBLIC'&&<>
        <label htmlFor="new-channel-username">{tr('Identifiant public (facultatif)','Public username (optional)')}</label>
        <div className="km-channel-username"><span>@</span><input id="new-channel-username"
          value={username} onChange={event=>setUsername(event.target.value)} minLength={5} maxLength={32}
          pattern="[a-zA-Z][a-zA-Z0-9_]{4,31}" placeholder="knowme_news"
          autoCapitalize="none" spellCheck={false}/></div>
        <p className="km-channel-hint">{tr('De 5 à 32 caractères : lettres, chiffres et tirets bas. Commence par une lettre.',
          '5 to 32 characters: letters, numbers and underscores. Must start with a letter.')}</p>
      </>}
      <button type="submit" className="km-channel-create" disabled={saving||!name.trim()}>
        {saving?tr('Création…','Creating…'):tr('Créer la chaîne','Create channel')}
      </button>
    </form>
  </main>;
}
