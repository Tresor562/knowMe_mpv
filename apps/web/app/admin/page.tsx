'use client';

import { useEffect, useState } from 'react';

type Dashboard = {
  users: number;
  posts: number;
  challenges: number;
  openReports: number;
};

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: {
    username: string;
    displayName: string;
  };
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState('');

  async function api(path: string, init?: RequestInit) {
    const token = localStorage.getItem('knowme_token');
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      }
    });
  }

  async function load() {
    const [dashboardResponse, reportsResponse] = await Promise.all([
      api('/admin/dashboard'),
      api('/admin/reports?status=OPEN')
    ]);

    if (!dashboardResponse.ok || !reportsResponse.ok) {
      setMessage('Accès administrateur requis.');
      return;
    }

    setDashboard(await dashboardResponse.json());
    setReports(await reportsResponse.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    const response = await api(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      setMessage('Impossible de traiter ce signalement.');
      return;
    }

    setReports((current) => current.filter((report) => report.id !== id));
    setDashboard((current) => current ? {
      ...current,
      openReports: Math.max(0, current.openReports - 1)
    } : current);
    setMessage(status === 'RESOLVED' ? 'Signalement résolu.' : 'Signalement rejeté.');
  }

  const stats = dashboard ? [
    ['Utilisateurs', dashboard.users],
    ['Publications', dashboard.posts],
    ['Défis', dashboard.challenges],
    ['Signalements ouverts', dashboard.openReports]
  ] : [];

  return (
    <main className="shell" style={{maxWidth:1100,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>ADMINISTRATION</small>
        <h1>Modération et sécurité</h1>
      </header>

      {message && <p>{message}</p>}

      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        {stats.map(([label,value]) => (
          <article className="card" key={label} style={{padding:22}}>
            <div style={{color:'var(--muted)'}}>{label}</div>
            <strong style={{fontSize:32}}>{value}</strong>
          </article>
        ))}
      </section>

      <section style={{marginTop:28}}>
        <h2>File des signalements</h2>
        <div className="grid">
          {reports.map((report) => (
            <article className="card" key={report.id} style={{padding:22}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
                <div>
                  <strong>{report.targetType}</strong>
                  <div style={{color:'var(--muted)'}}>Cible : {report.targetId}</div>
                </div>
                <small>{new Date(report.createdAt).toLocaleString('fr-FR')}</small>
              </div>

              <p>{report.reason}</p>
              <p style={{color:'var(--muted)'}}>
                Signalé par {report.reporter.displayName} (@{report.reporter.username})
              </p>

              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <button className="btn btn-primary" onClick={() => resolve(report.id, 'RESOLVED')}>
                  Résoudre
                </button>
                <button className="btn" onClick={() => resolve(report.id, 'DISMISSED')}>
                  Rejeter
                </button>
              </div>
            </article>
          ))}

          {!reports.length && (
            <article className="card" style={{padding:22,color:'var(--muted)'}}>
              Aucun signalement ouvert.
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
