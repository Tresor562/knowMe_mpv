'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type CircleEntry = {
  membership: {
    role: string;
    status: string;
  };
  circle: {
    id: string;
    type: string;
    name: string;
    slug: string;
    status: string;
    ownerUserId: string;
  };
  capabilities: {
    manage: boolean;
  };
};

type PublicMember = {
  role: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type CircleBundle = {
  circle: {
    id: string;
    type: string;
    name: string;
    slug: string;
    ownerUserId?: string;
  };
  members: PublicMember[];
  viewer: {
    member: boolean;
    role: string | null;
    canManage: boolean;
  };
};

export default function ProfileCircleMembersPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [circles, setCircles] = useState<CircleEntry[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [bundle, setBundle] = useState<CircleBundle | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCircles = useCallback(async () => {
    try {
      const entries = await apiFetch<CircleEntry[]>('/profile-circles/me');
      setCircles(entries);
      setSelectedCircleId((current) =>
        current || entries.find((entry) => entry.circle.status === 'ACTIVE')?.circle.id || ''
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Relations indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void loadCircles();
  }, [loadCircles, sessionLoading, user]);

  const selectedCircle = useMemo(
    () => circles.find((entry) => entry.circle.id === selectedCircleId) ?? null,
    [circles, selectedCircleId]
  );

  const loadMembers = useCallback(async () => {
    if (!selectedCircle) {
      setBundle(null);
      return;
    }
    try {
      const result = await apiFetch<CircleBundle>(
        `/profile-circle-governance/public/${encodeURIComponent(selectedCircle.circle.slug)}`
      );
      setBundle(result);
      setSelectedMemberId((current) =>
        result.members.some((member) => member.user.id === current)
          ? current
          : result.members.find((member) => member.user.id !== user?.id)?.user.id || ''
      );
      setMessage('');
    } catch (cause) {
      setBundle(null);
      setMessage(cause instanceof Error ? cause.message : 'Membres indisponibles.');
    }
  }, [selectedCircle, user?.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const selectedMember = useMemo(
    () => bundle?.members.find((member) => member.user.id === selectedMemberId) ?? null,
    [bundle, selectedMemberId]
  );

  async function submit(
    path: string,
    options: { method?: string; body?: unknown },
    success: string
  ) {
    setBusy(true);
    try {
      await apiFetch(path, {
        method: options.method ?? 'POST',
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
      });
      await Promise.all([loadCircles(), loadMembers()]);
      setMessage(success);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCircle || !selectedMember) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selectedCircle.circle.id}/members/${selectedMember.user.id}/role`,
      {
        method: 'PATCH',
        body: { role: String(data.get('role')) }
      },
      `Le rôle de ${selectedMember.user.displayName} a été mis à jour.`
    );
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCircle || !selectedMember) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selectedCircle.circle.id}/transfers`,
      {
        body: {
          toUserId: selectedMember.user.id,
          expiresInHours: Number(data.get('expiresInHours')),
          reason: String(data.get('reason') ?? '').trim() || undefined
        }
      },
      `Une proposition de propriété a été envoyée à ${selectedMember.user.displayName}.`
    );
  }

  async function proposeFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCircle || !selectedMember) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selectedCircle.circle.id}/family-relations`,
      {
        body: {
          otherUserId: selectedMember.user.id,
          type: String(data.get('type')),
          label: String(data.get('label') ?? '').trim() || undefined
        }
      },
      `Le lien familial a été proposé à ${selectedMember.user.displayName}.`
    );
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des membres…</p></main>;
  }

  const owner = selectedCircle?.membership.role === 'OWNER';
  const duo = selectedCircle?.circle.type.startsWith('DUO_') ?? false;

  return (
    <main
      className="shell"
      style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>GOUVERNANCE HUMAINE</small>
        <h1>Choisir une personne, pas copier un identifiant</h1>
        <p style={{ color: 'var(--muted)' }}>
          Les actions utilisent toujours les identifiants sécurisés côté serveur, mais
          l’interface affiche uniquement le nom, le pseudo et le rôle autorisés.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn" href="/profile-circle-governance">Contenus et modération</Link>
          <Link className="btn" href="/profile-circles">Mes relations</Link>
          <Link className="btn" href="/profile">Mon profil</Link>
        </div>
        {message && <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>}
      </section>

      <section className="card grid" style={{ padding: 22 }}>
        <label htmlFor="circle-select">Structure</label>
        <select
          id="circle-select"
          className="input"
          value={selectedCircleId}
          onChange={(event) => {
            setSelectedCircleId(event.target.value);
            setSelectedMemberId('');
          }}
        >
          <option value="">Sélectionner une structure</option>
          {circles.map((entry) => (
            <option value={entry.circle.id} key={entry.circle.id}>
              {entry.circle.name} · {entry.circle.type} · {entry.membership.role}
            </option>
          ))}
        </select>

        {bundle && (
          <>
            <label htmlFor="member-select">Membre actif</label>
            <select
              id="member-select"
              className="input"
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
            >
              <option value="">Choisir une personne</option>
              {bundle.members
                .filter((member) => member.user.id !== user.id)
                .map((member) => (
                  <option value={member.user.id} key={member.user.id}>
                    {member.user.displayName} · @{member.user.username} · {member.role}
                  </option>
                ))}
            </select>
          </>
        )}
      </section>

      {selectedMember && (
        <section className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--surface-2)',
                fontWeight: 900,
                fontSize: 22
              }}
            >
              {selectedMember.user.displayName[0]?.toUpperCase()}
            </div>
            <div>
              <h2 style={{ marginBottom: 2 }}>{selectedMember.user.displayName}</h2>
              <div style={{ color: 'var(--muted)' }}>@{selectedMember.user.username}</div>
              <small>Rôle actuel : {selectedMember.role}</small>
            </div>
          </div>
        </section>
      )}

      {selectedCircle && selectedMember && owner && !duo && (
        <form className="card grid" style={{ padding: 22 }} onSubmit={updateRole}>
          <h2>Modifier le rôle</h2>
          <select className="input" name="role" defaultValue={selectedMember.role === 'OWNER' ? 'MEMBER' : selectedMember.role}>
            <option value="ADMIN">Administrateur</option>
            <option value="OFFICER">Officier</option>
            <option value="MEMBER">Membre</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>Enregistrer le rôle</button>
          <small style={{ color: 'var(--muted)' }}>
            La propriété ne peut pas être attribuée avec un changement de rôle.
          </small>
        </form>
      )}

      {selectedCircle && selectedMember && owner && (
        <form className="card grid" style={{ padding: 22 }} onSubmit={transfer}>
          <h2>Proposer la propriété</h2>
          <p style={{ color: 'var(--muted)' }}>
            {selectedMember.user.displayName} devra accepter avant tout changement.
          </p>
          <label htmlFor="transfer-expiry">Expiration en heures</label>
          <input id="transfer-expiry" className="input" type="number" name="expiresInHours" min={1} max={168} defaultValue={72} required />
          <textarea className="input" name="reason" maxLength={300} placeholder="Raison facultative" />
          <button className="btn" disabled={busy}>Envoyer la proposition</button>
        </form>
      )}

      {selectedCircle?.circle.type === 'FAMILY' && selectedMember && (
        <form className="card grid" style={{ padding: 22 }} onSubmit={proposeFamily}>
          <h2>Proposer un lien familial déclaré</h2>
          <select className="input" name="type" defaultValue="SIBLING">
            <option value="PARENT">Parent</option>
            <option value="CHILD">Enfant</option>
            <option value="SIBLING">Frère / sœur</option>
            <option value="COUSIN">Cousin / cousine</option>
            <option value="SPOUSE">Partenaire</option>
            <option value="GUARDIAN">Responsable déclaré</option>
            <option value="OTHER">Autre</option>
          </select>
          <input className="input" name="label" maxLength={120} placeholder="Libellé facultatif" />
          <button className="btn btn-primary" disabled={busy}>Envoyer la proposition</button>
          <small style={{ color: 'var(--muted)' }}>
            Le lien restera invisible tant que {selectedMember.user.displayName} ne l’aura pas accepté.
          </small>
        </form>
      )}

      <section className="card" style={{ padding: 20 }}>
        <small style={{ color: 'var(--muted)' }}>
          Aucun email, KnowCoins ou donnée privée n’est affiché dans cette interface.
          Les permissions restent vérifiées côté serveur à chaque action.
        </small>
      </section>
    </main>
  );
}
