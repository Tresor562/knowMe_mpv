'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  ProfileMemberOption,
  ProfileMemberPicker
} from '../../components/profile-member-picker';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

const TYPES = [
  { value: 'DUO_COUPLE', label: '❤️ Couple', maximumOthers: 1 },
  { value: 'DUO_BEST_FRIENDS', label: '💙 Meilleurs amis', maximumOthers: 1 },
  { value: 'DUO_SIBLINGS', label: '💜 Frère / sœur', maximumOthers: 1 },
  { value: 'DUO_GAMING', label: '🩷 Duo gaming', maximumOthers: 1 },
  { value: 'DUO_CREATIVE', label: '💛 Duo créatif', maximumOthers: 1 },
  { value: 'TEAM', label: '⭐ Équipe', maximumOthers: 6 },
  { value: 'FAMILY', label: '👨‍👩‍👧‍👦 Famille', maximumOthers: 49 },
  { value: 'GUILD', label: '🎮 Guilde', maximumOthers: 499 }
] as const;

type CreatedCircle = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
};

export default function ProfileCircleCreatePage() {
  const { user, loading } = useSession({ required: true });
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('DUO_BEST_FRIENDS');
  const [members, setMembers] = useState<ProfileMemberOption[]>([]);
  const [created, setCreated] = useState<CreatedCircle | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const definition = useMemo(
    () => TYPES.find((entry) => entry.value === type) ?? TYPES[0],
    [type]
  );

  function changeType(next: (typeof TYPES)[number]['value']) {
    const nextDefinition = TYPES.find((entry) => entry.value === next) ?? TYPES[0];
    setType(next);
    setMembers((current) => current.slice(0, nextDefinition.maximumOthers));
    setCreated(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (members.length === 0) {
      setMessage('Sélectionne au moins une autre personne.');
      return;
    }
    setSubmitting(true);
    try {
      const circle = await apiFetch<CreatedCircle>('/profile-experience/circles', {
        method: 'POST',
        body: JSON.stringify({
          type,
          name: String(data.get('name') ?? '').trim(),
          sharedBio: String(data.get('sharedBio') ?? '').trim() || undefined,
          animationKey: String(data.get('animationKey') ?? '').trim() || undefined,
          accentColor: String(data.get('accentColor') ?? '#45e6bd'),
          memberUserIds: members.map((member) => member.id)
        })
      });
      setCreated(circle);
      setMessage(
        'Profil collectif créé. Les membres ont reçu une invitation en temps réel.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <main className="shell"><p>Chargement du créateur…</p></main>;
  }

  return (
    <main
      className="shell"
      style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K · CRÉATION</small>
        <h1>Créer un Duo, une Équipe, une Famille ou une Guilde</h1>
        <p style={{ color: 'var(--muted)' }}>
          Recherche les personnes par leur pseudo. Aucune donnée financière ou privée
          n’est utilisée dans la sélection. La structure reste en attente lorsque le
          consentement de tous les membres est requis.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn" href="/profile-circles">Mes relations</Link>
          <Link className="btn" href="/profile">Mon profil</Link>
        </div>
      </section>

      <form className="card grid" style={{ padding: 26 }} onSubmit={create}>
        <label htmlFor="circle-type">Type de profil collectif</label>
        <select
          id="circle-type"
          className="input"
          value={type}
          onChange={(event) =>
            changeType(event.target.value as (typeof TYPES)[number]['value'])
          }
        >
          {TYPES.map((entry) => (
            <option value={entry.value} key={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>

        <label htmlFor="circle-name">Nom</label>
        <input
          id="circle-name"
          className="input"
          name="name"
          minLength={2}
          maxLength={80}
          placeholder="Les Otakus"
          required
        />

        <label htmlFor="shared-bio">Présentation commune</label>
        <textarea
          id="shared-bio"
          className="input"
          name="sharedBio"
          maxLength={500}
          rows={4}
          placeholder="Une équipe liée par les anime, la créativité et les défis."
        />

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="grid">
            <label htmlFor="accent-color">Couleur</label>
            <input
              id="accent-color"
              className="input"
              type="color"
              name="accentColor"
              defaultValue="#45e6bd"
            />
          </div>
          <div className="grid">
            <label htmlFor="animation-key">Animation facultative</label>
            <input
              id="animation-key"
              className="input"
              name="animationKey"
              maxLength={80}
              placeholder="stars-link"
            />
          </div>
        </div>

        <ProfileMemberPicker
          selected={members}
          onChange={setMembers}
          maximum={definition.maximumOthers}
          label={`Membres à inviter · maximum ${definition.maximumOthers}`}
        />

        <button className="btn btn-primary" disabled={submitting || members.length === 0}>
          {submitting ? 'Création…' : 'Créer et envoyer les invitations'}
        </button>
      </form>

      {message && (
        <section className="card" style={{ padding: 20 }}>
          <p role="status" style={{ color: 'var(--mint)', margin: 0 }}>
            {message}
          </p>
          {created && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              <Link className="btn btn-primary" href="/profile-circles">
                Suivre les acceptations
              </Link>
              <Link className="btn" href={`/circles/${encodeURIComponent(created.slug)}`}>
                Ouvrir la page collective
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="card" style={{ padding: 20 }}>
        <small style={{ color: 'var(--muted)' }}>
          Les invitations sont personnelles et idempotentes. Un rafraîchissement ou
          un rejeu serveur ne crée pas plusieurs notifications identiques pour la même
          personne.
        </small>
      </section>
    </main>
  );
}
