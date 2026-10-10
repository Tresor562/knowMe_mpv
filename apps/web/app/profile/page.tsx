'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { AccountBadges } from '../../components/AccountBadges';
import { ProfileCover } from '../../components/profile-cover';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type InterestItem = {
  id: string;
  interest: { id: string; name: string; slug: string };
};

type Progression = {
  profile: {
    totalXp: number;
    level: number;
    progressPercent: number;
    xpToNextLevel: number;
  };
};

type PublicProfile = {
  header: { coverAssetId: string | null };
};

type UploadSession = { id: string; uploadToken: string };
type UploadedAsset = { id: string; status: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePage() {
  const { user, loading, refresh } = useSession({ required: true });
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [progression, setProgression] = useState<Progression['profile'] | null>(null);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.allSettled([
      apiFetch<InterestItem[]>('/intelligence/interests'),
      apiFetch<Progression>('/progression/me?limit=1'),
      apiFetch<PublicProfile>(`/profile-experience/public/${encodeURIComponent(user.username)}`)
    ]).then(([interestResult, xpResult, profileResult]) => {
      if (!active) return;
      setInterests(interestResult.status === 'fulfilled' ? interestResult.value : []);
      setProgression(xpResult.status === 'fulfilled' ? xpResult.value.profile : null);
      setCoverId(profileResult.status === 'fulfilled' ? profileResult.value.header.coverAssetId : null);
    });
    return () => { active = false; };
  }, [user?.id, user?.username]);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: String(data.get('displayName') ?? '').trim(),
          bio: String(data.get('bio') ?? '').trim(),
          ...(String(data.get('avatarUrl') ?? '').trim()
            ? { avatarUrl: String(data.get('avatarUrl')).trim() }
            : {})
        })
      });
      await refresh();
      setEditing(false);
      setMessage('Profil mis à jour.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
    }
  }

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const image = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!image) return;
    if (!IMAGE_MIME.includes(image.type) || image.size < 1024 || image.size > MAX_IMAGE_BYTES) {
      setMessage('Choisis une image JPEG, PNG ou WebP de 1 Ko à 5 Mo.');
      return;
    }
    setCoverBusy(true);
    setMessage('');
    try {
      const session = await apiFetch<UploadSession>('/media/uploads', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'POST',
          visibility: 'PRIVATE',
          maxBytes: MAX_IMAGE_BYTES,
          allowedMime: [image.type]
        })
      });
      const body = new FormData();
      body.append('file', image, image.name);
      const asset = await apiFetch<UploadedAsset>(
        `/media/uploads/${encodeURIComponent(session.id)}/complete`,
        { method: 'POST', headers: { 'x-upload-token': session.uploadToken }, body }
      );
      if (asset.status !== 'AVAILABLE') {
        throw new Error('Cette image doit être validée avant de pouvoir devenir la couverture.');
      }
      await apiFetch('/profile-experience/me', {
        method: 'PATCH',
        body: JSON.stringify({ coverAssetId: asset.id })
      });
      setCoverId(asset.id);
      setMessage('Couverture enregistrée. Elle est visible depuis ton compte.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Envoi de la couverture impossible.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function updateInterests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = String(data.get('interests') ?? '')
      .split(',').map(value => value.trim()).filter(Boolean);
    try {
      const updated = await apiFetch<InterestItem[]>('/intelligence/interests', {
        method: 'PUT',
        body: JSON.stringify({ interests: values })
      });
      setInterests(updated);
      setMessage('Centres d’intérêt enregistrés.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
  }

  if (loading || !user) return <main className="shell"><p>Chargement du profil…</p></main>;
  const initials = user.displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <main className="shell km-profile-page">
      <section className="km-profile-hero" aria-label="Mon profil KnowMe">
        <ProfileCover assetId={coverId} />
        <div className="km-profile-details">
          <div className="km-profile-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={`Photo de profil de ${user.displayName}`} />
            ) : <span>{initials}</span>}
          </div>
          <div className="km-profile-heading">
            <p className="km-profile-eyebrow">MON ESPACE KNOWME</p>
            <h1>{user.displayName}</h1>
            <AccountBadges staff={user.staff} verification={user.verification} premium={user.premium} />
            <p className="km-profile-handle">@{user.username}</p>
            <p className="km-profile-bio">{user.bio?.trim() || 'Ajoute une bio pour te présenter à ta communauté.'}</p>
          </div>
          <div className="km-profile-hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => setEditing(value => !value)}>
              {editing ? 'Fermer' : 'Modifier mon profil'}
            </button>
            <label className={`btn km-profile-cover-upload ${coverBusy ? 'is-busy' : ''}`}>
              {coverBusy ? 'Envoi…' : 'Changer la couverture'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} disabled={coverBusy} aria-label="Choisir une image de couverture" />
            </label>
          </div>
        </div>
      </section>

      {message && <p className="km-profile-notice" role="status">{message}</p>}

      {editing && (
        <section className="card km-profile-editor">
          <h2>Personnaliser mon identité</h2>
          <form className="grid" onSubmit={updateProfile}>
            <label>Nom affiché
              <input className="input" name="displayName" defaultValue={user.displayName} minLength={2} maxLength={80} required />
            </label>
            <label>Biographie
              <textarea className="input" name="bio" defaultValue={user.bio ?? ''} placeholder="Parle de toi…" rows={3} maxLength={500} />
            </label>
            <label>URL de ta photo de profil (facultatif)
              <input className="input" type="url" name="avatarUrl" placeholder="https://…" defaultValue={user.avatarUrl ?? ''} />
            </label>
            <div className="km-profile-editor-actions">
              <Link className="btn" href="/avatar-studio">Studio Avatar</Link>
              <button className="btn btn-primary" type="submit">Enregistrer</button>
            </div>
          </form>
        </section>
      )}

      <section className="km-profile-progress" aria-label="Expérience et progression">
        <div className="km-profile-progress-top">
          <div>
            <span className="km-profile-eyebrow">PROGRESSION</span>
            <h2>{progression ? `Niveau ${progression.level}` : 'Ton niveau KnowMe'}</h2>
          </div>
          {progression && <strong>{progression.totalXp.toLocaleString('fr-FR')} XP</strong>}
        </div>
        {progression ? (
          <>
            <div className="km-profile-progress-track" role="progressbar" aria-label="Progression du niveau" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progression.progressPercent))}>
              <span style={{ width: `${Math.max(0, Math.min(100, progression.progressPercent))}%` }} />
            </div>
            <p>{progression.xpToNextLevel.toLocaleString('fr-FR')} XP avant le prochain niveau</p>
          </>
        ) : <p>Le niveau et les XP apparaîtront lorsque la progression sera disponible.</p>}
        <Link href="/progression" className="km-profile-text-link">Voir toute ma progression →</Link>
      </section>

      <nav className="km-profile-shortcuts" aria-label="Raccourcis de mon profil">
        <Link href={`/profile/${encodeURIComponent(user.username)}`}>Voir mon profil public <span>↗</span></Link>
        <Link href="/profile-studio">Studio de profil <span>›</span></Link>
        <Link href="/avatar-studio">Avatar et photo <span>›</span></Link>
        <Link href="/settings">Paramètres <span>›</span></Link>
        <Link href="/gifts">Cadeaux <span>›</span></Link>
        <Link href="/profile-circles">Duos et équipes <span>›</span></Link>
      </nav>

      <section className="km-profile-interests">
        <h2>Centres d’intérêt</h2>
        <div className="km-profile-interests-list">
          {interests.length
            ? interests.map(item => <span key={item.id}>{item.interest.name}</span>)
            : <p>Ajoute tes centres d’intérêt pour personnaliser KnowMe.</p>}
        </div>
        <form onSubmit={updateInterests}>
          <label htmlFor="interests">Modifier mes centres d’intérêt, séparés par des virgules</label>
          <div className="km-profile-interests-form">
            <input id="interests" name="interests" defaultValue={interests.map(item => item.interest.name).join(', ')} placeholder="Musique, jeux, informatique…" required />
            <button className="btn" type="submit">Enregistrer</button>
          </div>
        </form>
      </section>
    </main>
  );
}
