'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, type ApiError } from '../../../lib/api';

type CreatorProfile = {
  slug: string;
  title: string;
  bio?: string | null;
  category: string;
  visibility: 'PUBLIC' | 'UNLISTED';
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  followerCount: number;
  version: number;
};

type Dashboard = {
  profile: CreatorProfile;
  windowDays: number;
  totals: {
    followers: number;
    posts: number;
    likes: number;
    comments: number;
    profileViews: number;
    postViews: number;
    followsGained: number;
    unfollows: number;
  };
  privacy: {
    uniqueAuthenticatedViewsOnly: boolean;
    rawViewerIdsStored: boolean;
    receiptRetentionDays: number;
  };
};

const CATEGORIES = ['TECH', 'EDUCATION', 'GAMING', 'LIFESTYLE', 'ART', 'MUSIC', 'SPORT', 'COMMUNITY', 'OTHER'];

export default function CreatorSettingsPage() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    slug: '',
    title: '',
    bio: '',
    category: 'TECH',
    visibility: 'PUBLIC' as 'PUBLIC' | 'UNLISTED',
    status: 'ACTIVE' as 'ACTIVE' | 'PAUSED'
  });

  async function refresh() {
    const current = await apiFetch<CreatorProfile | null>('/creators/me');
    setProfile(current);
    if (current) {
      setForm({
        slug: current.slug,
        title: current.title,
        bio: current.bio ?? '',
        category: current.category,
        visibility: current.visibility,
        status: current.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
      });
      setDashboard(await apiFetch<Dashboard>('/creators/me/dashboard'));
    } else {
      setDashboard(null);
    }
  }

  useEffect(() => {
    void refresh().catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Chargement impossible.'));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const saved = await apiFetch<CreatorProfile>('/creators/me', {
        method: 'PUT',
        body: JSON.stringify({ ...form, expectedVersion: profile?.version ?? 0 })
      });
      setProfile(saved);
      setMessage('Profil créateur synchronisé.');
      await refresh();
    } catch (cause) {
      if ((cause as ApiError)?.code === 'CREATOR_VERSION_CONFLICT') {
        await refresh().catch(() => undefined);
      }
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)', fontWeight: 800 }}>KMD-051 · CRÉATEURS</small>
        <h1>Profil créateur et audience</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Le mode créateur est volontaire et distinct de Premium, de la vérification et des rôles Équipe KnowMe.
        </p>
      </header>
      {message ? <p role="status" style={{ color: 'var(--orange)' }}>{message}</p> : null}

      {dashboard ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Object.entries(dashboard.totals).map(([key, value]) => (
            <div className="card" key={key} style={{ padding: 18 }}>
              <strong style={{ fontSize: 26 }}>{value}</strong>
              <div style={{ color: 'var(--muted)', marginTop: 5 }}>{key}</div>
            </div>
          ))}
        </section>
      ) : null}

      <form className="card" onSubmit={save} style={{ padding: 24, display: 'grid', gap: 15 }}>
        <label>Identifiant public<input className="input" value={form.slug} maxLength={40} pattern="[a-z0-9][a-z0-9_-]{2,39}" required onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} /></label>
        <label>Titre<input className="input" value={form.title} minLength={2} maxLength={80} required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Présentation<textarea className="input" value={form.bio} maxLength={300} rows={4} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
        <label>Catégorie<select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Visibilité<select className="input" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as 'PUBLIC' | 'UNLISTED' })}><option value="PUBLIC">Publique</option><option value="UNLISTED">Non listée</option></select></label>
        <label>État<select className="input" value={form.status} disabled={profile?.status === 'SUSPENDED'} onChange={(event) => setForm({ ...form, status: event.target.value as 'ACTIVE' | 'PAUSED' })}><option value="ACTIVE">Actif</option><option value="PAUSED">En pause</option></select></label>
        <button className="btn btn-primary" disabled={busy || profile?.status === 'SUSPENDED'}>{busy ? 'Enregistrement…' : profile ? 'Mettre à jour' : 'Activer le mode créateur'}</button>
        {profile ? <Link href={`/creator/${profile.slug}`}>Voir ma page publique</Link> : null}
      </form>

      {dashboard ? (
        <section className="card" style={{ padding: 22, marginTop: 20 }}>
          <h2>Mesure respectueuse</h2>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Les vues sont uniques par compte authentifié et par jour. L’identité brute n’est pas stockée ; les reçus hachés expirent après {dashboard.privacy.receiptRetentionDays} jours.
          </p>
        </section>
      ) : null}
    </main>
  );
}
