'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Access = { visible: boolean; reason: string };
type PublicProfile = {
  header: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    joinedYear: number | null;
    coverAssetId: string | null;
    coverVideoAssetId: string | null;
    frameAssetId: string | null;
    themeKey: string;
    effectKey: string | null;
    influencerMode: boolean;
    secretLink: string | null;
  };
  viewer: { relation: string; owner: boolean };
  privacy: {
    profileLocked: boolean;
    lockedForViewer: boolean;
    lockMessage: string | null;
    sections: Record<string, Access>;
    serverResolved: true;
    hiddenDataOmitted: true;
  };
  guard: {
    protected: boolean;
    style?: string;
    warnViewer?: boolean;
    disclosure?: { android: string; ios: string; web: string };
  };
  statistics: Record<string, number | string | boolean | null> | null;
  evolution: { tier: number; unlocks: string[] } | null;
  circles: Array<{
    id: string;
    type: string;
    name: string;
    slug: string;
    accentColor: string;
    level: number;
    xp: number;
    role: string;
  }> | null;
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    happenedAt: string;
  }> | null;
  wall: Array<{
    id: string;
    contentType: string;
    text: string | null;
    createdAt: string;
  }> | null;
  gifts: Array<{
    id: string;
    giftInstanceId: string;
    pinned: boolean;
    position: number;
  }> | null;
  compatibility: {
    overallBps: number;
    categories: unknown;
    explanation: unknown;
    privateSignalsExposed: false;
  } | null;
  shareCard: { shortCode: string; url: string; qrPayload: string };
};

function title(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLocaleLowerCase('fr')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('fr'));
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notice, setNotice] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const username = decodeURIComponent(params.username);
      setProfile(
        await apiFetch<PublicProfile>(
          `/profile-experience/public/${encodeURIComponent(username)}`
        )
      );
      setNotice('');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Profil indisponible.');
    }
  }, [params.username]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function postToWall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !user) return;
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') ?? '').trim();
    if (!text) return;
    setPosting(true);
    try {
      await apiFetch(
        `/profile-experience/public/${encodeURIComponent(profile.header.username)}/wall`,
        {
          method: 'POST',
          body: JSON.stringify({ contentType: 'TEXT', text })
        }
      );
      event.currentTarget.reset();
      setNotice(
        profile.viewer.owner
          ? 'Publication ajoutée au mur.'
          : 'Publication envoyée pour validation.'
      );
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setPosting(false);
    }
  }

  async function shareProfile() {
    if (!profile) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Profil KnowMe de ${profile.header.displayName}`,
          url: profile.shareCard.url
        });
      } else {
        await navigator.clipboard.writeText(profile.shareCard.url);
        setNotice('Lien du profil copié.');
      }
    } catch {
      setNotice('Partage annulé.');
    }
  }

  if (sessionLoading || !profile) {
    return <main className="shell"><p>{notice || 'Chargement du profil…'}</p></main>;
  }

  const initials = profile.header.displayName[0]?.toLocaleUpperCase('fr') ?? '?';

  return (
    <main
      className="shell"
      style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 20 }}
      data-profile-guard={profile.guard.protected ? 'protected' : 'off'}
    >
      <section
        className="card"
        style={{
          minHeight: 330,
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(145deg,var(--surface-2),var(--surface))'
        }}
      >
        <div
          style={{
            minHeight: 150,
            background: profile.header.coverAssetId
              ? `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.45)),url(${profile.header.coverAssetId}) center/cover`
              : 'radial-gradient(circle at 20% 20%,var(--mint),transparent 48%),radial-gradient(circle at 85% 15%,var(--orange),transparent 42%),var(--surface-2)'
          }}
        />
        <div style={{ padding: '0 26px 26px', display: 'flex', gap: 20, alignItems: 'end', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: '50%',
              marginTop: -54,
              display: 'grid',
              placeItems: 'center',
              fontSize: 42,
              fontWeight: 900,
              border: '5px solid var(--surface)',
              background: 'linear-gradient(135deg,var(--mint),var(--orange))',
              boxShadow: '0 16px 38px rgba(0,0,0,.28)'
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <small style={{ color: 'var(--mint)' }}>PROFIL KNOWME · {profile.header.themeKey}</small>
            <h1 style={{ margin: '4px 0' }}>
              {profile.privacy.profileLocked && '🔒 '}
              {profile.header.displayName}
            </h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              @{profile.header.username} · Vue {profile.viewer.relation}
              {profile.header.joinedYear ? ` · Depuis ${profile.header.joinedYear}` : ''}
            </p>
            {profile.header.bio && <p>{profile.header.bio}</p>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={shareProfile}>Partager la carte</button>
            {profile.header.secretLink && (
              <Link className="btn btn-accent" href={profile.header.secretLink}>
                🕵️ Message anonyme
              </Link>
            )}
            {profile.viewer.owner && (
              <Link className="btn btn-primary" href="/profile-studio">Modifier mon profil</Link>
            )}
          </div>
        </div>
        {profile.guard.protected && (
          <div
            className="card"
            style={{ margin: '0 26px 22px', padding: 14, borderStyle: 'dashed' }}
          >
            <strong>🛡️ Profil protégé · {profile.guard.style}</strong>
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
              Sur le Web, cette protection avertit et limite l’exposition serveur, mais ne peut pas empêcher une photo prise avec un autre appareil. Les applications mobiles utiliseront les protections natives disponibles.
            </p>
          </div>
        )}
      </section>

      {notice && <section className="card" style={{ padding: 14 }} role="status">{notice}</section>}

      {profile.privacy.lockedForViewer && (
        <section className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>🔒</div>
          <h2>Profil verrouillé</h2>
          <p style={{ color: 'var(--muted)' }}>{profile.privacy.lockMessage}</p>
          <button className="btn btn-primary">Ajouter en ami</button>
        </section>
      )}

      {profile.evolution && (
        <section className="card" style={{ padding: 22 }}>
          <small style={{ color: 'var(--mint)' }}>ÉVOLUTION VISUELLE</small>
          <h2>Profil niveau visuel {profile.evolution.tier}/5</h2>
          <p style={{ color: 'var(--muted)' }}>
            {profile.evolution.unlocks.map(title).join(' · ')}. Ce niveau est obtenu par la progression et ne peut pas être acheté.
          </p>
        </section>
      )}

      {profile.statistics && (
        <section>
          <h2>Statistiques</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
            {Object.entries(profile.statistics).map(([key, value]) => (
              <article className="card" style={{ padding: 18 }} key={key}>
                <strong style={{ fontSize: 26 }}>{String(value)}</strong>
                <div style={{ color: 'var(--muted)' }}>{title(key)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {profile.compatibility && (
        <section className="card" style={{ padding: 24 }}>
          <small style={{ color: 'var(--mint)' }}>COMPATIBILITÉ CONFIDENTIELLE</small>
          <h2>{Math.round(profile.compatibility.overallBps / 100)} % d’affinité</h2>
          <p style={{ color: 'var(--muted)' }}>
            Le résultat utilise uniquement des raisons agrégées. Aucun message privé ni centre d’intérêt masqué n’est révélé.
          </p>
        </section>
      )}

      {profile.circles && profile.circles.length > 0 && (
        <section>
          <h2>Duos, équipes, familles et guildes</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
            {profile.circles.map((circle) => (
              <article className="card" style={{ padding: 20, borderColor: circle.accentColor }} key={circle.id}>
                <small>{circle.type}</small>
                <h3>{circle.name}</h3>
                <p style={{ color: 'var(--muted)' }}>Niveau {circle.level} · {circle.xp} XP · {circle.role}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {profile.timeline && (
        <section className="card" style={{ padding: 24 }}>
          <h2>Souvenirs KnowMe</h2>
          {profile.timeline.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucun souvenir partagé avec cette audience.</p>
          ) : (
            profile.timeline.map((event) => (
              <article key={event.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <small style={{ color: 'var(--mint)' }}>{event.type} · {new Date(event.happenedAt).toLocaleDateString('fr-FR')}</small>
                <h3>{event.title}</h3>
                {event.description && <p style={{ color: 'var(--muted)' }}>{event.description}</p>}
              </article>
            ))
          )}
        </section>
      )}

      {profile.gifts && (
        <section className="card" style={{ padding: 24 }}>
          <h2>🎁 Galerie des cadeaux</h2>
          {profile.gifts.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucun cadeau exposé.</p>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              {profile.gifts.map((gift) => (
                <article className="card" style={{ padding: 16, textAlign: 'center' }} key={gift.id}>
                  <div style={{ fontSize: 38 }}>{gift.pinned ? '💎' : '🎁'}</div>
                  <small>{gift.giftInstanceId}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {profile.wall && (
        <section className="card" style={{ padding: 24 }}>
          <h2>Mur du profil</h2>
          {user ? (
            <form className="grid" onSubmit={postToWall} style={{ marginBottom: 20 }}>
              <textarea className="input" name="text" rows={3} maxLength={1000} placeholder="Laisse un message, un souvenir ou un mot…" required />
              <button className="btn btn-primary" disabled={posting}>{posting ? 'Envoi…' : 'Publier sur le mur'}</button>
            </form>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Connecte-toi pour participer au mur selon les règles du propriétaire.</p>
          )}
          {profile.wall.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Le mur attend son premier souvenir.</p>
          ) : (
            profile.wall.map((post) => (
              <article className="card" style={{ padding: 16, marginTop: 10 }} key={post.id}>
                <small>{post.contentType} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}</small>
                {post.text && <p>{post.text}</p>}
              </article>
            ))
          )}
        </section>
      )}

      <section className="card" style={{ padding: 18 }}>
        <strong>Confidentialité vérifiée côté serveur</strong>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Les sections interdites ne sont pas envoyées au navigateur. Une modification du HTML ou un appel direct à l’API ne permet pas de récupérer les données masquées.
        </p>
      </section>
    </main>
  );
}
