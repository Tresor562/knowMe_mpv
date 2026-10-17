'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { RuntimeBadge, RuntimeModule } from '../../components/runtime-experience-provider';

type Config = { revision: number; document: { badges: RuntimeBadge[]; modules: RuntimeModule[] } };
export function RuntimeExperiencePanel({ canGrant }: { canGrant: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [username, setUsername] = useState('');
  const [badgeKey, setBadgeKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try { setConfig(await apiFetch<Config>('/runtime-experience')); }
    catch { setMessage('Chargement de la configuration impossible.'); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const editBadge = (index: number, change: Partial<RuntimeBadge>) =>
    setConfig(current => current && ({ ...current, document: { ...current.document,
      badges: current.document.badges.map((badge, i) => i === index ? {...badge,...change} : badge)
    } }));
  async function publish() {
    if (!config) return;
    setBusy(true);
    try {
      const updated = await apiFetch<Config>('/admin/runtime-experience', {
        method:'PUT', body:JSON.stringify({expectedRevision:config.revision, document:config.document})
      });
      setConfig(updated);
      setMessage('Configuration publiée. Les clients la récupèrent sans nouvelle APK.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publication impossible.');
      await reload();
    } finally { setBusy(false); }
  }
  async function changeGrant(revoke: boolean) {
    if (!username || !badgeKey) return;
    setBusy(true);
    try {
      await apiFetch('/admin/runtime-experience/badges/grants', {
        method: revoke ? 'DELETE' : 'PUT', body: JSON.stringify({ username, badgeKey })
      });
      setMessage(revoke ? 'Badge retiré.' : 'Badge attribué.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Attribution impossible.');
    } finally { setBusy(false); }
  }
  return <section style={{marginTop:32}}>
    <h2>Expérience dynamique</h2>
    <p style={{color:'var(--muted)'}}>Ajout de badges décoratifs et de modules sans reconstruire le Web ou l’APK.
      Les badges officiels sont exclusivement pilotés par le système de vérification.</p>
    {message && <p role="status">{message}</p>}
    {config && <>
      <p>Révision publiée : {config.revision}</p>
      {config.document.badges.map((badge, index) => <div key={index} className="card"
        style={{padding:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:8}}>
        <input aria-label="Clé du badge" className="input" style={{maxWidth:180}}
          value={badge.key} onChange={event=>editBadge(index,{key:event.target.value})}/>
        <input aria-label="Nom du badge" className="input" style={{maxWidth:190}}
          value={badge.label} onChange={event=>editBadge(index,{label:event.target.value})}/>
        <input aria-label="Couleur du badge" type="color" value={badge.color}
          onChange={event=>editBadge(index,{color:event.target.value})}/>
        <select aria-label="Symbole" className="input" value={badge.symbol}
          onChange={event=>editBadge(index,{symbol:event.target.value as RuntimeBadge['symbol']})}>
          <option value="check">✓</option><option value="star">★</option>
          <option value="spark">✦</option>
        </select>
        {!['verified_blue','staff_gold'].includes(badge.key) &&
          <button type="button" className="btn" onClick={()=>setConfig(current=>current && ({
            ...current, document:{...current.document,
              badges:current.document.badges.filter((_,i)=>i!==index)}
          }))}>Supprimer</button>}
      </div>)}
      <button className="btn" type="button" onClick={()=>setConfig(current=>current&&({
        ...current, document:{...current.document,
          badges:[...current.document.badges,{key:'badge_'+(current.document.badges.length+1),
            label:'Nouveau badge',color:'#5367DC',symbol:'star'}]}
      }))}>Ajouter un badge</button>
      <h3>Modules dynamiques</h3>
      {config.document.modules.map((module,index)=><div key={index} className="card" style={{padding:12,display:'flex',gap:8,flexWrap:'wrap'}}>
        <input className="input" aria-label="Clé du module" value={module.key}
          onChange={e=>setConfig(current=>current&&({...current,document:{...current.document,
            modules:current.document.modules.map((item,i)=>i===index?{...item,key:e.target.value}:item)}}))}/>
        <input className="input" aria-label="Titre du module" value={module.title}
          onChange={e=>setConfig(current=>current&&({...current,document:{...current.document,
            modules:current.document.modules.map((item,i)=>i===index?{...item,title:e.target.value}:item)}}))}/>
        <select className="input" value={module.kind} onChange={e=>setConfig(current=>current&&({
          ...current,document:{...current.document,modules:current.document.modules.map((item,i)=>
            i===index?{...item,kind:e.target.value as RuntimeModule['kind']}:item)}
        }))}><option value="notice">Annonce</option><option value="tile">Carte</option><option value="link">Lien</option></select>
        <input className="input" aria-label="Route interne" placeholder="/feed" value={module.href??''}
          onChange={e=>setConfig(current=>current&&({...current,document:{...current.document,
            modules:current.document.modules.map((item,i)=>i===index?{...item,href:e.target.value || undefined}:item)}}))}/>
        <button className="btn" onClick={()=>setConfig(current=>current&&({...current,document:{
          ...current.document,modules:current.document.modules.filter((_,i)=>i!==index)}}))}>Supprimer</button>
      </div>)}
      <button className="btn" onClick={()=>setConfig(current=>current&&({...current,document:{
        ...current.document,modules:[...current.document.modules,{key:'module_'+(current.document.modules.length+1),
          title:'Nouvelle annonce',kind:'notice'}]}}))}>Ajouter un module</button>
      <div style={{marginTop:16}}><button className="btn btn-primary" disabled={busy}
        onClick={()=>void publish()}>Publier sur les clients</button></div>
      {canGrant && <div className="card" style={{padding:16,marginTop:16}}>
        <h3>Attribuer un badge décoratif</h3>
        <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username"/>
        <select className="input" value={badgeKey} onChange={e=>setBadgeKey(e.target.value)}>
          <option value="">Sélectionner un badge</option>
          {config.document.badges.filter(b=>!['verified_blue','staff_gold'].includes(b.key)).map(b=><option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={()=>void changeGrant(false)}>Attribuer</button>
        <button className="btn" disabled={busy} onClick={()=>void changeGrant(true)}>Retirer</button>
      </div>}
    </>}
  </section>;
}
