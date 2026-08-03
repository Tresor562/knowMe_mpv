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
    level: number;
    xp: number;
  };
  capabilities: {
    manage: boolean;
  };
};

type OwnershipTransfer = {
  id: string;
  circleId: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  expiresAt: string;
  circle: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  } | null;
  capabilities: {
    accept: boolean;
    cancel: boolean;
  };
};

type FamilyRelation = {
  id: string;
  circleId: string;
  firstUserId: string;
  secondUserId: string;
  type: string;
  inverseType: string;
  label: string | null;
  proposedById: string;
  status: string;
  createdAt: string;
};

type ModerationQueue = {
  moments: Array<{
    id: string;
    type: string;
    text: string | null;
    authorUserId: string;
    audience: string;
    createdAt: string;
  }>;
  stories: Array<{
    id: string;
    type: string;
    text: string | null;
    authorUserId: string;
    audience: string;
    expiresAt: string;
    createdAt: string;
  }>;
};

const CIRCLE_ROLES = ['ADMIN', 'OFFICER', 'MEMBER'];
const FAMILY_TYPES = [
  'PARENT',
  'CHILD',
  'SIBLING',
  'COUSIN',
  'SPOUSE',
  'GUARDIAN',
  'OTHER'
];

export default function ProfileCircleGovernancePage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [circles, setCircles] = useState<CircleEntry[]>([]);
  const [transfers, setTransfers] = useState<OwnershipTransfer[]>([]);
  const [familyRelations, setFamilyRelations] = useState<FamilyRelation[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [moderation, setModeration] = useState<ModerationQueue>({
    moments: [],
    stories: []
  });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [circleEntries, transferEntries, familyEntries] = await Promise.all([
        apiFetch<CircleEntry[]>('/profile-circles/me'),
        apiFetch<OwnershipTransfer[]>('/profile-circle-governance/me/transfers'),
        apiFetch<FamilyRelation[]>(
          '/profile-circle-governance/me/family-relations/pending'
        )
      ]);
      setCircles(circleEntries);
      setTransfers(transferEntries);
      setFamilyRelations(familyEntries);
      setSelectedCircleId((current) =>
        current || circleEntries.find((entry) => entry.circle.status === 'ACTIVE')?.circle.id || ''
      );
      setNotice('');
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : 'Centre de gouvernance indisponible.'
      );
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  const selected = useMemo(
    () => circles.find((entry) => entry.circle.id === selectedCircleId) ?? null,
    [circles, selectedCircleId]
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
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {})
      });
      await load();
      setNotice(success);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function createMoment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selected.circle.id}/moments`,
      {
        body: {
          type: String(data.get('type')),
          text: String(data.get('text') ?? '').trim() || undefined,
          audience: String(data.get('audience'))
        }
      },
      'Moment collectif envoyé.'
    );
    event.currentTarget.reset();
  }

  async function createStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selected.circle.id}/stories`,
      {
        body: {
          type: String(data.get('type')),
          text: String(data.get('text') ?? '').trim() || undefined,
          audience: String(data.get('audience')),
          durationHours: Number(data.get('durationHours'))
        }
      },
      'Story collective créée.'
    );
    event.currentTarget.reset();
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selected.circle.id}/transfers`,
      {
        body: {
          toUserId: String(data.get('toUserId')).trim(),
          expiresInHours: Number(data.get('expiresInHours')),
          reason: String(data.get('reason') ?? '').trim() || undefined
        }
      },
      'Transfert envoyé au membre. La propriété ne changera qu’après son acceptation.'
    );
    event.currentTarget.reset();
  }

  async function updateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const memberUserId = String(data.get('memberUserId')).trim();
    await submit(
      `/profile-circle-governance/${selected.circle.id}/members/${encodeURIComponent(memberUserId)}/role`,
      {
        method: 'PATCH',
        body: { role: String(data.get('role')) }
      },
      'Rôle collectif mis à jour.'
    );
    event.currentTarget.reset();
  }

  async function proposeFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    await submit(
      `/profile-circle-governance/${selected.circle.id}/family-relations`,
      {
        body: {
          otherUserId: String(data.get('otherUserId')).trim(),
          type: String(data.get('type')),
          label: String(data.get('label') ?? '').trim() || undefined
        }
      },
      'Lien familial proposé. Il restera privé jusqu’à son acceptation.'
    );
    event.currentTarget.reset();
  }

  async function loadModeration() {
    if (!selected) return;
    setBusy(true);
    try {
      setModeration(
        await apiFetch<ModerationQueue>(
          `/profile-circle-governance/${selected.circle.id}/moderation`
        )
      );
      setNotice('File de modération chargée.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Lecture impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function moderate(
    kind: 'moments' | 'stories',
    id: string,
    action: 'APPROVE' | 'HIDE' | 'REMOVE'
  ) {
    await submit(
      `/profile-circle-governance/${kind}/${id}/moderate`,
      { body: { action } },
      'Décision de modération enregistrée.'
    );
    await loadModeration();
  }

  async function familyAction(
    relationId: string,
    action: 'ACCEPT' | 'DECLINE' | 'REMOVE'
  ) {
    await submit(
      `/profile-circle-governance/family-relations/${relationId}/action`,
      { body: { action } },
      action === 'ACCEPT'
        ? 'Lien familial accepté.'
        : 'Décision familiale enregistrée.'
    );
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement de la gouvernance…</p></main>;
  }

  return (
    <main
      className="shell"
      style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 20 }}
    >
      <section className="card" style={{ padding: 28 }}>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K · GOUVERNANCE</small>
        <h1>Rôles, propriété, moments et famille</h1>
        <p style={{ color: 'var(--muted)' }}>
          La propriété se transfère uniquement après acceptation. Les publications
          publiques peuvent nécessiter une validation, et les liens familiaux restent
          invisibles avant le consentement de l’autre personne.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn" href="/profile-circles">Mes relations</Link>
          <Link className="btn" href="/profile">Mon profil</Link>
        </div>
        {notice && <p role="status" style={{ color: 'var(--mint)' }}>{notice}</p>}
      </section>

      <section className="card" style={{ padding: 22 }}>
        <label htmlFor="circle">Structure active</label>
        <select
          id="circle"
          className="input"
          value={selectedCircleId}
          onChange={(event) => {
            setSelectedCircleId(event.target.value);
            setModeration({ moments: [], stories: [] });
          }}
        >
          <option value="">Sélectionner</option>
          {circles.map((entry) => (
            <option value={entry.circle.id} key={entry.circle.id}>
              {entry.circle.name} · {entry.circle.type} · {entry.membership.role}
            </option>
          ))}
        </select>
        {selected && (
          <p style={{ color: 'var(--muted)' }}>
            Niveau {selected.circle.level} · {selected.circle.xp} XP · {selected.circle.status}
          </p>
        )}
      </section>

      {selected && (
        <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
          <form className="card grid" style={{ padding: 22 }} onSubmit={createMoment}>
            <h2>Publier un moment</h2>
            <select className="input" name="type" defaultValue="TEXT">
              {['TEXT', 'PHOTO', 'DRAWING', 'GIF', 'GIFT', 'ACHIEVEMENT'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select className="input" name="audience" defaultValue="MEMBERS">
              <option value="MEMBERS">Membres</option>
              <option value="PUBLIC">Public</option>
            </select>
            <textarea className="input" name="text" maxLength={2000} placeholder="Raconte ce moment…" required />
            <button className="btn btn-primary" disabled={busy}>Publier</button>
          </form>

          <form className="card grid" style={{ padding: 22 }} onSubmit={createStory}>
            <h2>Créer une Story</h2>
            <select className="input" name="type" defaultValue="TEXT">
              {['TEXT', 'PHOTO', 'VIDEO', 'GIFT', 'ACHIEVEMENT'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select className="input" name="audience" defaultValue="PUBLIC">
              <option value="PUBLIC">Public</option>
              <option value="MEMBERS">Membres</option>
            </select>
            <input className="input" type="number" name="durationHours" min={1} max={72} defaultValue={24} required />
            <textarea className="input" name="text" maxLength={1000} placeholder="Texte de la Story…" required />
            <button className="btn btn-primary" disabled={busy}>Créer</button>
          </form>

          {selected.capabilities.manage && (
            <form className="card grid" style={{ padding: 22 }} onSubmit={updateRole}>
              <h2>Modifier un rôle</h2>
              <input className="input" name="memberUserId" placeholder="ID du membre actif" required />
              <select className="input" name="role" defaultValue="MEMBER">
                {CIRCLE_ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>
              <button className="btn" disabled={busy}>Mettre à jour</button>
              <small style={{ color: 'var(--muted)' }}>
                La propriété ne peut jamais être donnée par ce formulaire.
              </small>
            </form>
          )}

          {selected.capabilities.manage && (
            <form className="card grid" style={{ padding: 22 }} onSubmit={createTransfer}>
              <h2>Transférer la propriété</h2>
              <input className="input" name="toUserId" placeholder="ID du membre destinataire" required />
              <input className="input" type="number" name="expiresInHours" min={1} max={168} defaultValue={72} required />
              <textarea className="input" name="reason" maxLength={300} placeholder="Raison facultative" />
              <button className="btn" disabled={busy}>Envoyer le transfert</button>
            </form>
          )}

          {selected.circle.type === 'FAMILY' && (
            <form className="card grid" style={{ padding: 22 }} onSubmit={proposeFamily}>
              <h2>Proposer un lien familial</h2>
              <input className="input" name="otherUserId" placeholder="ID de l’autre membre" required />
              <select className="input" name="type" defaultValue="SIBLING">
                {FAMILY_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
              <input className="input" name="label" maxLength={120} placeholder="Libellé personnalisé facultatif" />
              <button className="btn" disabled={busy}>Proposer</button>
            </form>
          )}
        </section>
      )}

      {selected?.capabilities.manage && (
        <section className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2>Modération collective</h2>
              <p style={{ color: 'var(--muted)' }}>Les publications publiques ordinaires attendent ici.</p>
            </div>
            <button className="btn" disabled={busy} onClick={() => void loadModeration()}>
              Charger la file
            </button>
          </div>
          <div className="grid">
            {moderation.moments.map((item) => (
              <article className="card" style={{ padding: 16 }} key={item.id}>
                <strong>Moment · {item.type}</strong>
                {item.text && <p>{item.text}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={busy} onClick={() => void moderate('moments', item.id, 'APPROVE')}>Approuver</button>
                  <button className="btn" disabled={busy} onClick={() => void moderate('moments', item.id, 'HIDE')}>Masquer</button>
                  <button className="btn" disabled={busy} onClick={() => void moderate('moments', item.id, 'REMOVE')}>Retirer</button>
                </div>
              </article>
            ))}
            {moderation.stories.map((item) => (
              <article className="card" style={{ padding: 16 }} key={item.id}>
                <strong>Story · {item.type}</strong>
                {item.text && <p>{item.text}</p>}
                <small>Expire le {new Date(item.expiresAt).toLocaleString('fr-FR')}</small>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={busy} onClick={() => void moderate('stories', item.id, 'APPROVE')}>Approuver</button>
                  <button className="btn" disabled={busy} onClick={() => void moderate('stories', item.id, 'HIDE')}>Masquer</button>
                  <button className="btn" disabled={busy} onClick={() => void moderate('stories', item.id, 'REMOVE')}>Retirer</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 24 }}>
        <h2>Transferts de propriété</h2>
        {transfers.length === 0 && <p style={{ color: 'var(--muted)' }}>Aucun transfert.</p>}
        <div className="grid">
          {transfers.map((transfer) => (
            <article className="card" style={{ padding: 16 }} key={transfer.id}>
              <strong>{transfer.circle?.name ?? transfer.circleId}</strong>
              <div>{transfer.status} · expire le {new Date(transfer.expiresAt).toLocaleString('fr-FR')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {transfer.capabilities.accept && (
                  <button className="btn btn-primary" disabled={busy} onClick={() => void submit(`/profile-circle-governance/transfers/${transfer.id}/accept`, {}, 'Tu es maintenant propriétaire de cette structure.')}>Accepter</button>
                )}
                {transfer.capabilities.cancel && (
                  <button className="btn" disabled={busy} onClick={() => void submit(`/profile-circle-governance/transfers/${transfer.id}/cancel`, {}, 'Transfert annulé.')}>Annuler</button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <h2>Liens familiaux à confirmer</h2>
        {familyRelations.length === 0 && <p style={{ color: 'var(--muted)' }}>Aucun lien en attente.</p>}
        <div className="grid">
          {familyRelations.map((relation) => (
            <article className="card" style={{ padding: 16 }} key={relation.id}>
              <strong>{relation.type}</strong>
              {relation.label && <p>{relation.label}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => void familyAction(relation.id, 'ACCEPT')}>Accepter</button>
                <button className="btn" disabled={busy} onClick={() => void familyAction(relation.id, 'DECLINE')}>Refuser</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <small style={{ color: 'var(--muted)' }}>
          Aucun transfert n’est automatique. Aucun lien familial n’est déduit. Les
          contenus en attente ne deviennent publics qu’après une décision autorisée.
        </small>
      </section>
    </main>
  );
}
