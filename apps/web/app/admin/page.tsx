'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Dashboard = { users:number; posts:number; challenges:number; openReports:number };
type Report = {
  id:string; targetType:string; targetId:string; reason:string; status:string; createdAt:string;
  reporter:{ username:string; displayName:string };
};

export default function AdminPage() {
  const { user, loading:sessionLoading } = useSession({ required:true });
  const [dashboard,setDashboard] = useState<Dashboard|null>(null);
  const [reports,setReports] = useState<Report[]>([]);
  const [message,setMessage] = useState('');
  const [loading,setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [stats, queue] = await Promise.all([
        apiFetch<Dashboard>('/admin/dashboard'),
        apiFetch<Report[]>('/admin/reports?status=OPEN')
      ]);
      setDashboard(stats);
      setReports(queue);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Accès administrateur requis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!sessionLoading && user?.role === 'ADMIN') load(); else if (!sessionLoading) setLoading(false); }, [load,sessionLoading,user?.role]);

  async function resolve(id:string,status:'RESOLVED'|'DISMISSED') {
    try {
      await apiFetch(`/admin/reports/${id}`,{method:'PATCH',body:JSON.stringify({status})});
      setReports(current => current.filter(report => report.id !== id));
      setDashboard(current => current ? {...current,openReports:Math.max(0,current.openReports-1)} : current);
      setMessage(status === 'RESOLVED' ? 'Signalement résolu.' : 'Signalement rejeté.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de traiter ce signalement.');
    }
  }

  if (sessionLoading || loading) return <main className="shell"><p>Chargement de la modération…</p></main>;
  if (user?.role !== 'ADMIN') return <main className="shell"><article className="card" style={{padding:24}}><h1>Accès refusé</h1><p>Cette zone est réservée aux administrateurs KnowMe.</p></article></main>;

  const stats = dashboard ? [
    ['Utilisateurs',dashboard.users],['Publications',dashboard.posts],['Défis',dashboard.challenges],['Signalements ouverts',dashboard.openReports]
  ] : [];

  return (
    <main className="shell" style={{maxWidth:1100,margin:'0 auto'}}>
      <header><small style={{color:'var(--orange)'}}>ADMINISTRATION</small><h1>Modération et sécurité</h1><p style={{color:'var(--muted)'}}>Connecté en tant que {user.displayName}</p></header>
      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}

      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        {stats.map(([label,value]) => <article className="card" key={label} style={{padding:22}}><div style={{color:'var(--muted)'}}>{label}</div><strong style={{fontSize:32}}>{value}</strong></article>)}
      </section>

      <section style={{marginTop:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2>File des signalements</h2><button className="btn" onClick={load}>Actualiser</button></div>
        <div className="grid">
          {reports.map(report => (
            <article className="card" key={report.id} style={{padding:22}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><strong>{report.targetType}</strong><div style={{color:'var(--muted)'}}>Cible : {report.targetId}</div></div><small>{new Date(report.createdAt).toLocaleString('fr-FR')}</small></div>
              <p>{report.reason}</p>
              <p style={{color:'var(--muted)'}}>Signalé par {report.reporter.displayName} (@{report.reporter.username})</p>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="btn btn-primary" onClick={() => resolve(report.id,'RESOLVED')}>Résoudre</button><button className="btn" onClick={() => resolve(report.id,'DISMISSED')}>Rejeter</button></div>
            </article>
          ))}
          {!reports.length && <article className="card" style={{padding:22,color:'var(--muted)'}}>Aucun signalement ouvert.</article>}
        </div>
      </section>
    </main>
  );
}
