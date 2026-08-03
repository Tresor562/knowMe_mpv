'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type VisibilityRule = {
  id: string;
  section: string;
  audience: string;
  allowedWhenLocked: boolean;
};

type ProfileDashboard = {
  profile: {
    themeKey: string;
    effectKey: string | null;
    influencerMode: boolean;
    wallMode: 'PUBLIC' | 'FRIENDS' | 'DISABLED';
    profileLocked: boolean;
    profileEvolutionEnabled: boolean;
    weatherEffectsEnabled: boolean;
    seasonalEffectsEnabled: boolean;
    birthdayEffectsEnabled: boolean;
    animatedAvatarEnabled: boolean;
    publicShortCode: string;
  };
  guard: {
    enabled: boolean;
    scopes: unknown;
    style: string;
    warnViewer: boolean;
    notifyOwner: boolean;
    premiumGranularControl: boolean;
    platformDisclosureAccepted: boolean;
  } | null;
  stats: { metrics: Record<string, number> } | null;
  visibilities: VisibilityRule[];
  circles: Array<{
    id: string;
    role: string;
    status: string;
    circle: { id: string; type: string; name: string; status: string; level: number; xp: number };
  }>;
  timeline: Array<{ id: string; title: string; happenedAt: string }>;
  memories: Array<{ id: string; type: string; label: string; capturedAt: string }>;
  shareCard: { shortCode: string; qrPayload: string } | null;
  evolution: { tier: number; unlocks: string[]; purchasable: false };
};

const AUDIENCES = [
  'PUBLIC',
  'FRIENDS',
  'FOLLOWERS',
  'BEST_FRIENDS',
  'DUO',
  'TEAM',
  'FAMILY',
  'GUILD',
  'COMMUNITIES',
  'PRIVATE'
];

const GUARD_SCOPES = [
  'PROFILE',
  'PRIVATE_MESSAGES',
  'SECRET_MESSAGES',
  'VIEW_ONCE_MEDIA',
  'RARE_GIFTS',
  'SECRET_CONVERSATIONS',
  'PAYMENTS',
  'ADMIN',
  'SENSITIVE_DOCUMENTS'
];

export default function ProfileStudioPage() {
  const { user, loading } = useSession({ required: true });
  const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDashboard(await apiFetch<ProfileDashboard>('/profile-experience/me'));
      setNotice('');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Studio de profil indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!loading && user) void load();
  }, [load, loading, user]);

  const activeGuardScopes = useMemo(() => {
    const value = dashboard?.guard?.scopes;
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  }, [dashboard?.guard?.scopes]);

  async function patchProfile(patch: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await apiFetch('/profile-experience/me', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      await load();
      setNotice(success);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function saveGuard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scopes = GUARD_SCOPES.filter((scope) => form.get(`scope:${scope}`) === 'on');
    setBusy(true);
    try {
      await apiFetch('/profile-experience/me/guard', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: form.get('enabled') === 'on',
          scopes,
          style: String(form.get('style') ?? 'GLASS'),
          warnViewer: form.get('warnViewer') === 'on',
          notifyOwner: form.get('notifyOwner') === 'on',
          platformDisclosureAccepted: form.get('platformDisclosureAccepted') === 'on'
        })
      });
      await load();
      setNotice('Profile Guard mis à jour.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Profile Guard non modifié.');
    } finally {
      setBusy(false);
    }
  }

  async function updateRule(rule: VisibilityRule, patch: Partial<VisibilityRule>) {
    setBusy(true);
    try {
      await apiFetch('/profile-experience/me/visibility', {
        method: 'PUT',
        body: JSON.stringify({
          rules: [
            {
              section: rule.section,
              audience: patch.audience ?? rule.audience,
              allowedWhenLocked: patch.allowedWhenLocked ?? rule.allowedWhenLocked
            }
          ]
        })
      });
      await load();
      setNotice(`Visibilité de ${rule.section} mise à jour.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Visibilité non modifiée.');
    } finally {
      setBusy(false);
    }
  }

  async function createCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberUserIds = String(form.get('members') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      await apiFetch('/profile-experience/circles', {
        method: 'POST',
        body: JSON.stringify({
          type: String(form.get('type')),
          name: String(form.get('name')).trim(),
          memberUserIds,
          sharedBio: String(form.get('sharedBio') ?? '').trim() || undefined,
          accentColor: String(form.get('accentColor') ?? '#45e6bd')
        })
      });
      event.currentTarget.reset();
      await load();
      setNotice('Invitation de relation créée. Elle restera en attente du consentement des membres.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Relation non créée.');
    } finally {
      setBusy(false);
    }
  }

  async function addMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiFetch('/profile-experience/me/memories', {
        method: 'POST',
        body: JSON.stringify({
          type: String(form.get('type')),
          label: String(form.get('label')).trim(),
          privateValue: String(form.get('privateValue') ?? '').trim() || undefined
        })
      });
      event.currentTarget.reset();
      await load();
      setNotice('Souvenir ajouté au coffre privé.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Souvenir non ajouté.');
    } finally {
      setBusy(false);
    }
  }

  async function shareCard() {
    if (!dashboard?.shareCard) return;
    const url = dashboard.shareCard.qrPayload;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Profil KnowMe de ${user?.displayName ?? ''}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice('Lien de carte copié.');
      }
    } catch {
      setNotice('Partage annulé.');
    }
  }

  if (loading || !user || !dashboard) {
    return <main className="shell"><p>{notice || 'Chargement du studio de profil…'}</p></main>;
  }

  const metrics = dashboard.stats?.metrics ?? {};

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 20 }}>
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K · PROFIL KNOWME</small>
        <h1>Ton profil raconte ton histoire</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Organise ton identité, tes relations, tes souvenirs et ta confidentialité. Les données masquées sont retirées par le serveur, pas seulement cachées à l’écran.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href={`/profile/${encodeURIComponent(user.username)}`}>Voir mon profil</Link>
          <button className="btn" onClick={shareCard}>Partager ma carte</button>
          <span className="btn" aria-label="Niveau d’évolution">Évolution {dashboard.evolution.tier}/5</span>
        </div>
        {notice && <p role="status" style={{ color: 'var(--mint)' }}>{notice}</p>}
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))' }}>
        {Object.entries(metrics).slice(0, 12).map(([key, value]) => (
          <article className="card" style={{ padding: 18 }} key={key}>
            <strong style={{ fontSize: 26 }}>{String(value)}</strong>
            <div style={{ color: 'var(--muted)' }}>{key}</div>
          </article>
        ))}
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Profil vivant et verrouillage</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={() => patchProfile({ profileLocked: !dashboard.profile.profileLocked }, dashboard.profile.profileLocked ? 'Profil déverrouillé.' : 'Profil verrouillé pour les personnes extérieures.') }>
            {dashboard.profile.profileLocked ? '🔒 Profil verrouillé' : '🔓 Profil ouvert'}
          </button>
          <button className="btn" disabled={busy} onClick={() => patchProfile({ influencerMode: !dashboard.profile.influencerMode }, 'Mode Influenceur mis à jour.') }>
            {dashboard.profile.influencerMode ? 'Mode Influenceur actif' : 'Activer Influenceur'}
          </button>
          <button className="btn" disabled={busy} onClick={() => patchProfile({ weatherEffectsEnabled: !dashboard.profile.weatherEffectsEnabled }, 'Effets météo mis à jour.') }>
            Météo : {dashboard.profile.weatherEffectsEnabled ? 'active' : 'inactive'}
          </button>
          <button className="btn" disabled={busy} onClick={() => patchProfile({ seasonalEffectsEnabled: !dashboard.profile.seasonalEffectsEnabled }, 'Effets saisonniers mis à jour.') }>
            Saisons : {dashboard.profile.seasonalEffectsEnabled ? 'actives' : 'inactives'}
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>🛡️ Profile Guard</h2>
        <p style={{ color: 'var(--muted)' }}>
          Android utilise la protection native maximale. iOS et le Web appliquent seulement les protections permises et n’offrent pas de garantie absolue.
        </p>
        <form className="grid" onSubmit={saveGuard}>
          <label><input type="checkbox" name="enabled" defaultChecked={dashboard.guard?.enabled} /> Protéger mon profil</label>
          <label><input type="checkbox" name="warnViewer" defaultChecked={dashboard.guard?.warnViewer ?? true} /> Avertir le visiteur</label>
          <label><input type="checkbox" name="notifyOwner" defaultChecked={dashboard.guard?.notifyOwner ?? false} /> Demander une notification lorsque le signal natif est vérifiable</label>
          <label><input type="checkbox" name="platformDisclosureAccepted" defaultChecked={dashboard.guard?.platformDisclosureAccepted} /> J’ai compris les limites selon le système</label>
          <select className="input" name="style" defaultValue={dashboard.guard?.style ?? 'GLASS'}>
            {['GLASS', 'CRYSTAL', 'NEON', 'GOLD', 'PREMIUM', 'ANIME', 'CYBER', 'GALAXY', 'MAGIC'].map((style) => <option key={style}>{style}</option>)}
          </select>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {GUARD_SCOPES.map((scope) => (
              <label key={scope} className="card" style={{ padding: 12 }}>
                <input type="checkbox" name={`scope:${scope}`} defaultChecked={activeGuardScopes.includes(scope) || scope === 'PROFILE'} /> {scope}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy}>Enregistrer Profile Guard</button>
        </form>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Confidentialité par section</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {dashboard.visibilities.map((rule) => (
            <article key={rule.section} className="card" style={{ padding: 14, display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) minmax(170px,220px) auto', gap: 12, alignItems: 'center' }}>
              <strong>{rule.section}</strong>
              <select className="input" value={rule.audience} disabled={busy} onChange={(event) => void updateRule(rule, { audience: event.target.value })}>
                {AUDIENCES.map((audience) => <option key={audience}>{audience}</option>)}
              </select>
              <label><input type="checkbox" checked={rule.allowedWhenLocked} disabled={busy} onChange={(event) => void updateRule(rule, { allowedWhenLocked: event.target.checked })} /> visible verrouillé</label>
            </article>
          ))}
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <form className="card grid" style={{ padding: 22 }} onSubmit={createCircle}>
          <h2>Duo, équipe, famille ou guilde</h2>
          <select className="input" name="type" defaultValue="DUO_BEST_FRIENDS">
            {['DUO_COUPLE', 'DUO_BEST_FRIENDS', 'DUO_SIBLINGS', 'DUO_GAMING', 'DUO_CREATIVE', 'TEAM', 'FAMILY', 'GUILD'].map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="input" name="name" placeholder="Nom de la relation" required minLength={2} />
          <input className="input" name="members" placeholder="IDs des membres, séparés par des virgules" required />
          <textarea className="input" name="sharedBio" placeholder="Bio commune ou phrase liée" maxLength={160} />
          <input className="input" type="color" name="accentColor" defaultValue="#45e6bd" />
          <button className="btn btn-primary" disabled={busy}>Créer et inviter</button>
          <small style={{ color: 'var(--muted)' }}>Aucune relation n’est affichée avant le consentement requis.</small>
        </form>

        <form className="card grid" style={{ padding: 22 }} onSubmit={addMemory}>
          <h2>Coffre des souvenirs</h2>
          <select className="input" name="type" defaultValue="MOMENT_CAPTURE">
            {['AVATAR', 'COVER', 'USERNAME', 'THEME', 'SEASONAL_BADGE', 'PRECIOUS_GIFT', 'MOMENT_CAPTURE'].map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="input" name="label" placeholder="Nom du souvenir" required />
          <textarea className="input" name="privateValue" placeholder="Note privée, ancien pseudo…" maxLength={500} />
          <button className="btn btn-accent" disabled={busy}>Ajouter au coffre privé</button>
          <small style={{ color: 'var(--muted)' }}>Les anciennes identités restent privées par défaut.</small>
        </form>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Relations</h2>
        {dashboard.circles.length === 0 ? <p style={{ color: 'var(--muted)' }}>Aucune relation liée.</p> : dashboard.circles.map((entry) => (
          <article className="card" style={{ padding: 14, marginTop: 10 }} key={entry.id}>
            <strong>{entry.circle.name}</strong> · {entry.circle.type} · {entry.status} · Niveau {entry.circle.level} · {entry.circle.xp} XP
          </article>
        ))}
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Souvenirs privés</h2>
        {dashboard.memories.length === 0 ? <p style={{ color: 'var(--muted)' }}>Ton histoire commencera ici.</p> : dashboard.memories.slice(0, 20).map((memory) => (
          <article className="card" style={{ padding: 14, marginTop: 10 }} key={memory.id}>
            <strong>{memory.label}</strong> · {memory.type} · {new Date(memory.capturedAt).toLocaleDateString('fr-FR')}
          </article>
        ))}
      </section>
    </main>
  );
}
