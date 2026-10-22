'use client';
import { knowMeConfirm } from '../../../../components/knowme-feedback';


import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';
import { useI18n } from '../../../../components/i18n-provider';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';
type GroupMember = {
  userId: string;
  role: Role;
  user: { id: string; username: string; displayName: string; avatarUrl: string|null };
};
type GroupPermissions={
  membersCanSendMessages:boolean;
  membersCanSendMedia:boolean;
  membersCanSendStickers:boolean;
  membersCanEditInfo:boolean;
  membersCanAddMembers:boolean;
};
type Group = {
  id: string; title: string|null; description: string|null;
  viewerRole: Role; memberCount: number; members: GroupMember[];
  permissions:GroupPermissions;
};
type Friend = { user: { id: string; displayName: string; username: string; avatarUrl?: string|null } };

export default function GroupManagementPage() {
  const {id} = useParams<{id:string}>();
  const router=useRouter();
  const {user,loading:sessionLoading}=useSession({required:true});
  const {locale}=useI18n();
  const en=locale==='en';
  const tr=(fr:string,english:string)=>en?english:fr;
  const base=`/conversations/${encodeURIComponent(id)}/group`;
  const infoHref=`/messages/${encodeURIComponent(id)}/info`;
  const [group,setGroup]=useState<Group|null>(null);
  const [friends,setFriends]=useState<Friend[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [editOpen,setEditOpen]=useState(false);
  const [addOpen,setAddOpen]=useState(false);

  const load=useCallback(async()=>{
    if(!user||!id)return;
    setLoading(true);
    try {
      const detail=await apiFetch<Group>(base);
      setGroup(detail);
      setTitle(detail.title||'');
      setDescription(detail.description||'');
      setSelected(new Set());
      setError('');
      if(detail.viewerRole!=='MEMBER'||detail.permissions?.membersCanAddMembers) {
        const friendsList=await apiFetch<Friend[]>('/social/friends');
        setFriends(friendsList);
      }
    }catch(cause) {
      setGroup(null);
      setError(cause instanceof Error?cause.message:tr('Groupe inaccessible.','Group unavailable.'));
    }finally{setLoading(false);}
  },[user?.id,id,locale]);
  useEffect(()=>{void load();},[load]);

  const eligible=useMemo(()=>{
    if(!group)return [];
    const ids=new Set(group.members.map(member=>member.userId));
    const term=search.trim().toLocaleLowerCase();
    return friends.filter(({user:friend})=>!ids.has(friend.id) &&
      `${friend.displayName} ${friend.username}`.toLocaleLowerCase().includes(term))
      .sort((a,b)=>a.user.displayName.localeCompare(b.user.displayName,locale));
  },[friends,group,search,locale]);

  async function execute(action:()=>Promise<unknown>,done?:()=>void,refresh=true) {
    if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try {
      await action();
      if(done)done();
      if(refresh)await load();
      if(refresh)setSuccess(tr('Modifications enregistrées.','Changes saved.'));
    }catch(cause) {
      setError(cause instanceof Error?cause.message:tr('Opération impossible.','Operation failed.'));
    }finally{setBusy(false);}
  }

  async function setPermission(key:keyof GroupPermissions,enabled:boolean){
    if(!group||busy||group.viewerRole==='MEMBER')return;
    await execute(()=>apiFetch(`${base}/permissions`,{
      method:'PATCH',body:JSON.stringify({[key]:enabled})
    }));
  }

  async function saveGroup(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!title.trim()||!group)return;
    await execute(()=>apiFetch(base,{method:'PATCH',body:JSON.stringify({
      title:title.trim(),description:description.trim()
    })}),()=>setEditOpen(false));
  }

  async function addMembers(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected.size)return;
    await execute(()=>apiFetch(`${base}/members`,{
      method:'POST',body:JSON.stringify({userIds:[...selected]})
    }),()=>{setAddOpen(false);setSearch('');});
  }

  async function changeRole(member:GroupMember){
    const role=member.role==='ADMIN'?'MEMBER':'ADMIN';
    const question=role==='ADMIN'
      ?tr(`Nommer ${member.user.displayName} administrateur ?`,
          `Make ${member.user.displayName} an admin?`)
      :tr(`Retirer les droits d’administration de ${member.user.displayName} ?`,
          `Remove admin rights from ${member.user.displayName}?`);
    if(!await knowMeConfirm(question))return;
    void execute(()=>apiFetch(`${base}/members/${encodeURIComponent(member.userId)}/role`,{
      method:'PATCH',body:JSON.stringify({role})
    }));
  }

  async function remove(member:GroupMember){
    const own=member.userId===user?.id;
    const question=own
      ?tr('Quitter définitivement ce groupe ?','Leave this group?')
      :tr(`Retirer ${member.user.displayName} du groupe ?`,
        `Remove ${member.user.displayName} from the group?`);
    if(!await knowMeConfirm(question))return;
    void execute(()=>apiFetch(`${base}/members/${encodeURIComponent(member.userId)}`,{
      method:'DELETE'
    }),own?()=>router.replace('/messages'):undefined,!own);
  }

  const roleLabel=(role:Role)=>role==='OWNER'?tr('Propriétaire','Owner'):
    role==='ADMIN'?tr('Administrateur','Admin'):tr('Membre','Member');
  const canManage=group?.viewerRole==='OWNER'||group?.viewerRole==='ADMIN';
  const canEdit=canManage||Boolean(group?.permissions.membersCanEditInfo);
  const canAdd=canManage||Boolean(group?.permissions.membersCanAddMembers);
  if(sessionLoading||!user)return <main className="shell km-info-page"><p role="status">{tr('Chargement…','Loading…')}</p></main>;
  return <main className="shell km-info-page km-group-manage">
    <header className="km-info-topbar">
      <Link href={infoHref} className="km-info-back" aria-label={tr('Retour','Back')}>
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <h1>{tr('Gestion du groupe','Group management')}</h1>
      <button type="button" className="km-info-refresh" disabled={loading||busy}
        onClick={()=>void load()} aria-label={tr('Actualiser','Refresh')}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 8V3h-5M4 16v5h5"/><path d="M5 9a8 8 0 0 1 14-3l1 2M4 16l1 2a8 8 0 0 0 14-3"/></svg>
      </button>
    </header>
    {loading&&<p role="status" className="km-info-status">{tr('Chargement du groupe…','Loading group…')}</p>}
    {error&&<p role="alert" className="km-auth-error">{error}</p>}
    {success&&<p role="status" className="km-group-success">{success}</p>}
    {!loading&&group&&<>
      <section className="km-group-manage-intro">
        <h2>{group.title||tr('Groupe sans nom','Untitled group')}</h2>
        <p>{group.memberCount} {tr('membres','members')} · {roleLabel(group.viewerRole)}</p>
        {group.description&&<p>{group.description}</p>}
      </section>
      {(canEdit||canAdd)&&<>
        <div className="km-group-manage-actions">
          {canEdit&&<button type="button" disabled={busy} onClick={()=>setEditOpen(v=>!v)}>
            {tr('Modifier le groupe','Edit group')}
          </button>}
          {canAdd&&<button type="button" disabled={busy} onClick={()=>setAddOpen(v=>!v)}>
            {tr('Ajouter des membres','Add members')}
          </button>}
        </div>
        {editOpen&&canEdit&&<form className="km-group-inline-form" onSubmit={saveGroup}>
          <label htmlFor="km-group-edit-title">{tr('Nom du groupe','Group name')}</label>
          <input id="km-group-edit-title" maxLength={90} required value={title}
            onChange={event=>setTitle(event.target.value)}/>
          <label htmlFor="km-group-edit-description">{tr('Description','Description')}</label>
          <textarea id="km-group-edit-description" maxLength={512} rows={3}
            value={description} onChange={event=>setDescription(event.target.value)}/>
          <button type="submit" disabled={busy||!title.trim()}>{tr('Enregistrer','Save')}</button>
        </form>}
        {addOpen&&canAdd&&<form className="km-group-inline-form" onSubmit={addMembers}>
          <label htmlFor="km-group-friend-search">{tr('Choisir des amis','Choose friends')}</label>
          <input id="km-group-friend-search" type="search" value={search}
            onChange={event=>setSearch(event.target.value)}
            placeholder={tr('Rechercher parmi tes amis','Search your friends')}/>
          {eligible.length===0&&<p>{tr('Aucun ami disponible à ajouter.','No friends available to add.')}</p>}
          <div className="km-group-friend-list">
            {eligible.map(({user:friend})=><label key={friend.id}>
              <input type="checkbox" checked={selected.has(friend.id)}
                onChange={event=>setSelected(previous=>{
                  const next=new Set(previous);
                  event.target.checked?next.add(friend.id):next.delete(friend.id);
                  return next;
                })}/>
              <span>{friend.displayName} <small>@{friend.username}</small></span>
            </label>)}
          </div>
          <button type="submit" disabled={busy||selected.size===0}>
            {tr('Ajouter','Add')} ({selected.size})
          </button>
        </form>}
      </>}
      {canManage&&<section aria-label={tr('Autorisations du groupe','Group permissions')}
        className="km-group-permissions" style={{margin:'14px 0',display:'grid',gap:8}}>
        <h2 className="km-group-section-heading">{tr('Autorisations des membres','Member permissions')}</h2>
        <p className="km-info-hint">{tr('Les administrateurs restent autorisés. Ces règles sont vérifiées par le serveur.',
          'Admins remain allowed. These rules are enforced by the server.')}</p>
        {([
          ['membersCanSendMessages',tr('Envoyer des messages','Send messages')],
          ['membersCanSendMedia',tr('Envoyer des photos, vidéos, documents et audios','Send photos, videos, documents and audio')],
          ['membersCanSendStickers',tr('Envoyer des stickers et GIF','Send stickers and GIFs')],
          ['membersCanEditInfo',tr('Modifier le nom et la description du groupe','Edit group name and description')],
          ['membersCanAddMembers',tr('Ajouter des membres (amis)','Add friends')]
        ] as Array<[keyof GroupPermissions,string]>).map(([key,label])=>
          <label key={key} style={{display:'flex',alignItems:'center',gap:10,minHeight:45,
             padding:'6px 0',fontSize:14}}>
            <input type="checkbox" checked={Boolean(group.permissions[key])} disabled={busy}
              onChange={e=>void setPermission(key,e.target.checked)}
              aria-label={label}/>
            <span>{label}</span>
          </label>)}
      </section>}
      <h2 className="km-group-section-heading">{tr('Participants et rôles','Members and roles')}</h2>
      <div className="km-group-role-list">
        {group.members.map(member=>{
          const self=member.userId===user.id;
          const canRemove=member.role!=='OWNER'&&(self||group.viewerRole==='OWNER'||
            (group.viewerRole==='ADMIN'&&member.role==='MEMBER'));
          return <div className="km-group-role-row" key={member.userId}>
            <Link href={`/profile/${encodeURIComponent(member.user.username)}`}
              className="km-group-member-info">
              <span className="km-info-member-avatar is-small">
                {member.user.avatarUrl?<img src={member.user.avatarUrl} alt="" />:
                  (Array.from(member.user.displayName)[0]||'?').toLocaleUpperCase()}
              </span>
              <span>
                <strong>{member.user.displayName}{self?` ${tr('(vous)','(you)')}`:''}</strong>
                <small>@{member.user.username} · {roleLabel(member.role)}</small>
              </span>
            </Link>
            <div className="km-group-row-actions">
              {group.viewerRole==='OWNER'&&member.role!=='OWNER'&&
                <button type="button" disabled={busy} onClick={()=>changeRole(member)}
                  aria-label={member.role==='ADMIN'?tr('Retirer administrateur','Remove admin'):
                    tr('Nommer administrateur','Make admin')}>
                  {member.role==='ADMIN'?tr('Rétrograder','Demote'):tr('Admin','Admin')}
                </button>}
              {canRemove&&<button type="button" disabled={busy} onClick={()=>remove(member)}
                className="is-danger">{self?tr('Quitter','Leave'):tr('Retirer','Remove')}</button>}
            </div>
          </div>;
        })}
      </div>
      {group.viewerRole==='OWNER'&&<p className="km-info-hint">
        {tr('Le propriétaire ne peut pas quitter le groupe avant la mise en place d’un transfert sécurisé de propriété.',
          'The owner cannot leave before secure ownership transfer is available.')}
      </p>}
    </>}
  </main>;
}
