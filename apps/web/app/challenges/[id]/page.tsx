'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Question = {
  id: string;
  prompt: string;
  position: number;
  version: number;
};
type Answer = { id: string; questionId: string; value: string };
type Participant = {
  id: string;
  userId: string;
  challengeVersion: number;
  completedAt?: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  answers: Answer[];
};
type VersionSnapshot = {
  id: string;
  version: number;
  title: string;
  description?: string | null;
  visibility: string;
  questionCount: number;
  changeReason?: string | null;
  createdAt: string;
};
type RewardPolicy = {
  key: string;
  version: number;
  amount: number;
  dailyLimitPerUser: number;
  minQuestions: number;
};
type RewardDecision = {
  status: 'AWARDED' | 'REJECTED' | 'IGNORED';
  amount: number;
  explanation?: string | null;
};
type RewardResult = {
  event: RewardDecision;
  replayed: boolean;
};
type SubmitResponse = {
  reward?: RewardResult | null;
};
type Challenge = {
  id: string;
  title: string;
  description?: string | null;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  creatorId: string;
  createdAt: string;
  currentVersion: number;
  viewerVersion: number;
  isCurrentVersion: boolean;
  canEdit: boolean;
  canAnswer: boolean;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  questions: Question[];
  participants: Participant[];
  versions: VersionSnapshot[];
  versionSnapshot?: VersionSnapshot | null;
  rewardPolicy?: RewardPolicy | null;
};

function rewardMessage(reward?: RewardResult | null) {
  if (!reward) return 'Tes réponses ont été enregistrées.';
  if (reward.event.status === 'AWARDED') {
    return `Défi terminé : +${reward.event.amount} KnowCoins. ${reward.event.explanation ?? ''}`.trim();
  }
  return reward.event.explanation || 'Défi terminé sans nouvelle récompense.';
}

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setChallenge(await apiFetch<Challenge>(`/challenges/${id}`));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Défi introuvable.');
    }
  }, [id]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const myParticipation = useMemo(
    () => challenge?.participants.find((participant) => participant.userId === user?.id),
    [challenge, user?.id]
  );

  async function submitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !challenge.canAnswer) return;
    const data = new FormData(event.currentTarget);
    const answers = challenge.questions.map((question) => ({
      questionId: question.id,
      value: String(data.get(question.id) ?? '').trim()
    }));
    if (answers.some((answer) => !answer.value)) {
      setMessage('Réponds à toutes les questions avant de valider.');
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch<SubmitResponse>(
        `/challenges/${challenge.id}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({ answers })
        }
      );
      setMessage(rewardMessage(result.reward));
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Enregistrement impossible.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !challenge.canEdit || saving) return;
    const data = new FormData(event.currentTarget);
    const questions = String(data.get('questions') ?? '')
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!questions.length) {
      setMessage('Ajoute au moins une question à la nouvelle version.');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<Challenge>(`/challenges/${challenge.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: challenge.currentVersion,
          title: String(data.get('title') ?? '').trim(),
          description: String(data.get('description') ?? '').trim(),
          visibility: String(data.get('visibility') ?? 'PRIVATE'),
          questions,
          changeReason: String(data.get('changeReason') ?? '').trim()
        })
      });
      setChallenge(updated);
      setEditing(false);
      setMessage(
        `Version ${updated.currentVersion} publiée. Les anciennes parties restent figées.`
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Publication de la nouvelle version impossible.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeChallenge() {
    if (
      !challenge ||
      !window.confirm(
        'Terminer ce défi ? Les nouvelles réponses et modifications seront bloquées.'
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/challenges/${challenge.id}/complete`, { method: 'PATCH' });
      setMessage('Le défi est terminé.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Clôture impossible.');
    }
  }

  if (sessionLoading || !challenge) {
    return (
      <main className="shell">
        <p>{message || 'Chargement du défi…'}</p>
      </main>
    );
  }

  const isCreator = challenge.creatorId === user?.id;
  const policy = challenge.rewardPolicy;
  const meetsQuestionMinimum = Boolean(
    policy && challenge.questions.length >= policy.minQuestions
  );

  return (
    <main className="shell" style={{ maxWidth: 940, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: 'var(--orange)' }}>DÉFI KNOWME</small>
          <h1>{challenge.title}</h1>
          <p style={{ color: 'var(--muted)' }}>
            Créé par {challenge.creator.displayName} (@{challenge.creator.username})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/wallet" className="btn">
            Mes KnowCoins
          </Link>
          <Link href="/challenges" className="btn">
            Retour aux défis
          </Link>
        </div>
      </header>

      {message && (
        <p role="alert" style={{ color: 'var(--orange)' }}>
          {message}
        </p>
      )}

      {!challenge.isCurrentVersion && (
        <section className="card" style={{ padding: 18, marginBottom: 18 }}>
          <strong>Partie historique — version {challenge.viewerVersion}</strong>
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
            Tes questions et réponses restent figées sur cette version. La version actuelle
            du défi est la v{challenge.currentVersion}.
          </p>
        </section>
      )}

      <section className="card" style={{ padding: 22, marginBottom: 20 }}>
        {challenge.description && (
          <p style={{ fontSize: 18, lineHeight: 1.6 }}>{challenge.description}</p>
        )}
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            color: 'var(--muted)'
          }}
        >
          <span>Version jouée : v{challenge.viewerVersion}</span>
          <span>Version actuelle : v{challenge.currentVersion}</span>
          <span>{challenge.questions.length} question(s)</span>
          <span>{challenge.participants.length} participant(s)</span>
          <span>Visibilité : {challenge.visibility}</span>
          <span>Statut : {challenge.status}</span>
        </div>
        {isCreator && challenge.status === 'ACTIVE' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Fermer l’éditeur' : 'Créer une nouvelle version'}
            </button>
            <button className="btn btn-accent" onClick={completeChallenge}>
              Terminer le défi
            </button>
          </div>
        )}
      </section>

      {policy && (
        <section className="card" style={{ padding: 20, marginBottom: 20, borderColor: '#f4c95d' }}>
          <small style={{ color: '#f4c95d' }}>RÉCOMPENSE SERVEUR</small>
          <h2 style={{ marginBottom: 8 }}>{policy.amount} KnowCoins</h2>
          {isCreator ? (
            <p style={{ color: 'var(--muted)' }}>
              Le créateur ne reçoit pas de récompense pour son propre défi.
            </p>
          ) : meetsQuestionMinimum ? (
            <p style={{ color: 'var(--muted)' }}>
              Attribués une seule fois après toutes les réponses de la v
              {challenge.viewerVersion}. Plafond quotidien : {policy.dailyLimitPerUser}{' '}
              KnowCoins.
            </p>
          ) : (
            <p style={{ color: 'var(--muted)' }}>
              Cette version n’atteint pas le minimum de {policy.minQuestions} questions
              requis par la politique v{policy.version}.
            </p>
          )}
        </section>
      )}

      {editing && challenge.canEdit && (
        <form
          className="card grid"
          onSubmit={publishVersion}
          style={{ padding: 22, marginBottom: 20 }}
        >
          <div>
            <small style={{ color: 'var(--mint)' }}>PUBLICATION IMMUTABLE</small>
            <h2>Préparer la version {challenge.currentVersion + 1}</h2>
            <p style={{ color: 'var(--muted)' }}>
              La v{challenge.currentVersion} ne sera jamais écrasée. Saisis la liste complète
              des questions de la prochaine version, une par ligne.
            </p>
          </div>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Titre</strong>
            <input
              className="input"
              name="title"
              defaultValue={challenge.title}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Description</strong>
            <textarea
              className="input"
              name="description"
              defaultValue={challenge.description ?? ''}
              rows={3}
              maxLength={500}
            />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Visibilité</strong>
            <select className="input" name="visibility" defaultValue={challenge.visibility}>
              <option value="PRIVATE">Privé</option>
              <option value="FRIENDS">Amis</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Questions complètes de la nouvelle version</strong>
            <textarea
              className="input"
              name="questions"
              defaultValue={challenge.questions
                .map((question) => question.prompt)
                .join('\n')}
              rows={Math.min(14, Math.max(5, challenge.questions.length + 2))}
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <strong>Motif de la modification</strong>
            <textarea
              className="input"
              name="changeReason"
              placeholder="Ex. Ajout de nouvelles questions et clarification du thème."
              rows={3}
              minLength={3}
              maxLength={500}
              required
            />
          </label>
          <button className="btn btn-primary" disabled={saving}>
            {saving
              ? 'Publication…'
              : `Publier la version ${challenge.currentVersion + 1}`}
          </button>
        </form>
      )}

      {challenge.status === 'ACTIVE' && myParticipation && challenge.canAnswer && (
        <form className="card grid" onSubmit={submitAnswers} style={{ padding: 22 }}>
          <h2>
            {myParticipation.completedAt
              ? `Modifier mes réponses — v${myParticipation.challengeVersion}`
              : `Répondre au défi — v${myParticipation.challengeVersion}`}
          </h2>
          {myParticipation.completedAt && (
            <p style={{ color: 'var(--muted)' }}>
              Modifier tes réponses ne déclenche jamais une seconde récompense.
            </p>
          )}
          {challenge.questions.map((question, index) => {
            const current =
              myParticipation.answers.find((answer) => answer.questionId === question.id)
                ?.value ?? '';
            return (
              <label key={question.id} style={{ display: 'grid', gap: 8 }}>
                <strong>
                  {index + 1}. {question.prompt}
                </strong>
                <textarea
                  className="input"
                  name={question.id}
                  defaultValue={current}
                  rows={3}
                  maxLength={1000}
                  required
                />
              </label>
            );
          })}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer mes réponses'}
          </button>
        </form>
      )}

      {challenge.status === 'ACTIVE' && myParticipation && !challenge.canAnswer && (
        <section className="card" style={{ padding: 20 }}>
          <strong>Participation conservée</strong>
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
            Cette participation appartient à la v{myParticipation.challengeVersion}. Elle
            n’est pas déplacée automatiquement vers la v{challenge.currentVersion}, afin de
            préserver ses réponses et son historique.
          </p>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h2>Participants</h2>
        <div className="grid">
          {challenge.participants.map((participant) => (
            <article
              className="card"
              key={participant.id}
              style={{
                padding: 18,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'center'
              }}
            >
              <div>
                <strong>{participant.user.displayName}</strong>
                <div style={{ color: 'var(--muted)' }}>
                  @{participant.user.username} · version {participant.challengeVersion}
                </div>
              </div>
              <small
                style={{
                  color: participant.completedAt ? 'var(--mint)' : 'var(--muted)'
                }}
              >
                {participant.completedAt ? 'Réponses terminées' : 'En cours'}
              </small>
            </article>
          ))}
        </div>
      </section>

      {isCreator && (
        <section style={{ marginTop: 28 }}>
          <h2>Historique immuable</h2>
          <div className="grid">
            {challenge.versions.map((version) => (
              <article className="card" key={version.id} style={{ padding: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <strong>
                    Version {version.version}
                    {version.version === challenge.currentVersion ? ' · actuelle' : ''}
                  </strong>
                  <small>{new Date(version.createdAt).toLocaleString('fr-FR')}</small>
                </div>
                <p>{version.title}</p>
                <p style={{ color: 'var(--muted)' }}>
                  {version.questionCount} question(s) · {version.visibility}
                </p>
                {version.changeReason && <p>{version.changeReason}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
