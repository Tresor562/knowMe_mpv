'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { knowMeConfirm } from '../../../components/knowme-feedback';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch, type ApiError } from '../../../lib/api';
import {
  CREATOR_CATEGORIES, creatorFormIssue, creatorFormPayload,
  type CreatorForm, type CreatorStatus, type CreatorVisibility
} from '../../../lib/creator-profile-editor';

type CreatorProfile = CreatorForm & {
  bio?: string | null;
  followerCount: number;
  version: number;
  status: CreatorStatus | 'SUSPENDED';
};

type Dashboard = {
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
  privacy: { uniqueAuthenticatedViewsOnly: boolean; rawViewerIdsStored: boolean;
    receiptRetentionDays: number };
};

const DEFAULT_FORM: CreatorForm = {
  slug: '', title: '', bio: '', category: 'TECH',
  visibility: 'PUBLIC', status: 'ACTIVE'
};

function fromProfile(profile: CreatorProfile): CreatorForm {
  return {
    slug: profile.slug, title: profile.title, bio: profile.bio ?? '',
    category: profile.category, visibility: profile.visibility,
    status: profile.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
  };
}

const METRIC_NAMES: Record<string, readonly [string, string]> = {
  followers: ['Abonnés', 'Followers'],
  posts: ['Publications', 'Posts'],
  likes: ['J’aime', 'Likes'],
  comments: ['Commentaires', 'Comments'],
  profileViews: ['Visites du profil', 'Profile views'],
  postViews: ['Vues des publications', 'Post views'],
  followsGained: ['Nouveaux abonnés', 'New followers'],
  unfollows: ['Désabonnements', 'Unfollows']
};

const CATEGORY_NAMES: Record<string, readonly [string, string]> = {
  TECH: ['Technologie', 'Technology'], EDUCATION: ['Éducation', 'Education'],
  GAMING: ['Jeux vidéo', 'Gaming'], LIFESTYLE: ['Lifestyle', 'Lifestyle'],
  ART: ['Art', 'Art'], MUSIC: ['Musique', 'Music'], SPORT: ['Sport', 'Sport'],
  COMMUNITY: ['Communauté', 'Community'], OTHER: ['Autre', 'Other']
};

export default function CreatorSettingsPage() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [form, setForm] = useState<CreatorForm>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const readDashboard = useCallback(async () => {
    try {
      const next = await apiFetch<Dashboard>('/creators/me/dashboard');
      setDashboard(next);
      setStatsUnavailable(false);
      return true;
    } catch {
      setDashboard(null);
      setStatsUnavailable(true);
      return false;
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setMessage('');
    setMessageError(false);
    try {
      const current = await apiFetch<CreatorProfile | null>('/creators/me');
      setProfile(current);
      setForm(current ? fromProfile(current) : DEFAULT_FORM);
      setConflict(false);
      setDashboard(null);
      setStatsUnavailable(false);
      if (current) await readDashboard();
    } catch (cause) {
      setLoadError(true);
      setMessage(cause instanceof Error ? cause.message : 'Creator settings unavailable.');
      setMessageError(true);
    } finally {
      setLoading(false);
    }
  }, [readDashboard]);

  useEffect(() => { void reload(); }, [reload]);

  async function confirmReload() {
    if (busy || loading) return;
    if (!await knowMeConfirm(tr(
      'Recharger les données du serveur ? Tes modifications non enregistrées seront perdues.',
      'Reload server data? Your unsaved changes will be discarded.'
    ))) return;
    await reload();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError || profile?.status === 'SUSPENDED') return;
    if (creatorFormIssue(form)) return;
    setBusy(true);
    setMessage('');
    setMessageError(false);
    try {
      const updated = await apiFetch<CreatorProfile>('/creators/me', {
        method: 'PUT',
        body: JSON.stringify(creatorFormPayload(form, profile?.version ?? 0))
      });
      // Server-approved mutation is authoritative. A failed analytics request
      // must never present the already-saved profile as a failed update.
      setProfile(updated);
      setForm(fromProfile(updated));
      setConflict(false);
      setDashboard(null);
      const statsLoaded = await readDashboard();
      setMessage(statsLoaded
        ? tr('Profil créateur enregistré.', 'Creator profile saved.')
        : tr('Profil enregistré. Les statistiques sont temporairement indisponibles.',
          'Profile saved. Statistics are temporarily unavailable.'));
    } catch (cause) {
      if ((cause as ApiError)?.code === 'CREATOR_VERSION_CONFLICT') {
        // Never replace in-progress form edits without explicit permission.
        setConflict(true);
        setMessage(tr(
          'Ce profil a été modifié ailleurs. Tes changements sont conservés. Recharge volontairement la version serveur avant de les réappliquer.',
          'This profile changed elsewhere. Your edits are preserved. Reload the server version deliberately before reapplying them.'
        ));
      } else {
        setMessage(cause instanceof Error ? cause.message :
          tr('Enregistrement impossible.', 'Could not save this profile.'));
      }
      setMessageError(true);
    } finally {
      setBusy(false);
    }
  }

  const issue = creatorFormIssue(form);
  const suspended = profile?.status === 'SUSPENDED';
  const disabled = busy || loading || loadError || suspended;
  const fieldsDisabled = disabled;
  const metricEntries = dashboard ? Object.entries(dashboard.totals) : [];

  return (
    <main className="shell" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href="/settings" style={{ color: 'var(--mint)', fontWeight: 700 }}>
            ← {tr('Paramètres', 'Settings')}
          </Link>
          <h1 style={{ marginBottom: 5 }}>{tr('Mon espace créateur', 'My creator space')}</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 610 }}>
            {tr('Personnalise ta vitrine et choisis précisément qui peut la découvrir.',
              'Customize your creator page and control how people can discover it.')}
          </p>
        </div>
        {profile ? <span className="card" style={{ padding: '8px 13px', borderRadius: 22,
          color: 'var(--mint)', fontWeight: 700 }}>
          {suspended ? tr('Suspendu', 'Suspended') : form.status === 'PAUSED'
            ? tr('En pause', 'Paused') : tr('Actif', 'Active')}
        </span> : null}
      </header>

      {message ? (
        <p role={messageError ? 'alert' : 'status'}
          style={{ color: messageError ? 'var(--orange)' : 'var(--mint)', margin: 0 }}>
          {message}
        </p>
      ) : null}

      {conflict ? (
        <section className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <strong>{tr('Une version plus récente existe sur le serveur.',
            'A newer version exists on the server.')}</strong>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            {tr('Tes saisies restent visibles. Le rechargement demande une confirmation.',
              'Your entries remain visible. Reloading requires confirmation.')}
          </p>
          <button type="button" className="btn" onClick={() => void confirmReload()}
            disabled={busy || loading}>
            {tr('Recharger la version serveur', 'Reload server version')}
          </button>
        </section>
      ) : null}

      {loading ? (
        <div className="card" role="status" style={{ padding: 24 }}>
          {tr('Chargement du profil créateur…', 'Loading creator settings…')}
        </div>
      ) : loadError ? (
        <div className="card" style={{ padding: 24, display: 'grid', gap: 12 }}>
          <p style={{ color: 'var(--muted)' }}>
            {tr('Le profil ne peut pas être chargé pour le moment. Aucun nouveau profil ne sera créé par erreur.',
              'The creator profile could not be loaded. No new profile will be created accidentally.')}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void reload()}>
            {tr('Réessayer', 'Retry')}
          </button>
        </div>
      ) : (
        <>
          {profile && !suspended && (
            <Link className="btn" href={`/creator/${encodeURIComponent(profile.slug)}`}
              style={{ justifySelf: 'start' }}>
              {tr('Voir ma vitrine', 'View creator page')} ↗
            </Link>
          )}

          <form className="card" onSubmit={save} style={{ padding: 22, display: 'grid', gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {tr('Identité créateur', 'Creator identity')}
              </h2>
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
                {tr('Différente de ton compte KnowMe principal.',
                  'Separate from your main KnowMe account.')}
              </p>
            </div>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>{tr('Identifiant public', 'Public identifier')}</strong>
              <input className="input" value={form.slug} maxLength={40}
                pattern="[a-z0-9][a-z0-9_-]{2,39}" required disabled={fieldsDisabled}
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={event => setForm(current => ({ ...current, slug: event.target.value.toLowerCase() }))} />
              <small style={{ color: 'var(--muted)' }}>
                {tr('Entre 3 et 40 caractères : lettres, chiffres, tiret et souligné.',
                  '3–40 characters: letters, numbers, dash and underscore.')}
              </small>
            </label>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>{tr('Nom de la page', 'Page title')}</strong>
              <input className="input" value={form.title} minLength={2} maxLength={80}
                required disabled={fieldsDisabled}
                onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>{tr('Présentation', 'About')}</strong>
              <textarea className="input" value={form.bio} maxLength={300}
                disabled={fieldsDisabled} rows={4}
                onChange={event => setForm(current => ({ ...current, bio: event.target.value }))} />
              <small style={{ color: 'var(--muted)', textAlign: 'right' }}>{form.bio.length}/300</small>
            </label>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>{tr('Catégorie', 'Category')}</strong>
              <select className="input" value={form.category} disabled={fieldsDisabled}
                onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
                {CREATOR_CATEGORIES.map(category => <option key={category} value={category}>
                  {CATEGORY_NAMES[category]?.[en ? 1 : 0] ?? category}
                </option>)}
              </select>
            </label>

            <section className="card" style={{ display: 'grid', gap: 11, padding: 16,
              borderRadius: 20, background: 'var(--surface, transparent)' }}>
              <strong>{tr('Visibilité de la page', 'Page visibility')}</strong>
              <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                {form.visibility === 'UNLISTED'
                  ? tr('Non répertoriée : les personnes disposant du lien peuvent la consulter, sans affichage dans les découvertes.',
                    'Unlisted: anyone with the link can view it, but it is not listed in discovery.')
                  : tr('Publique : la page peut apparaître dans les découvertes.',
                    'Public: your page can be featured in discovery.')}
              </p>
              <div role="group" aria-label={tr('Visibilité de la page', 'Page visibility')}
                style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['PUBLIC', 'UNLISTED'] as const).map(value => (
                  <button key={value} type="button"
                    className={form.visibility === value ? 'btn btn-primary' : 'btn'}
                    aria-pressed={form.visibility === value}
                    disabled={fieldsDisabled}
                    onClick={() => setForm(current => ({ ...current, visibility: value }))}>
                    {value === 'PUBLIC' ? tr('Public', 'Public') : tr('Non répertorié', 'Unlisted')}
                  </button>
                ))}
              </div>
            </section>

            {profile ? (
              <label style={{ display: 'grid', gap: 7 }}>
                <strong>{tr('Statut de la page', 'Page status')}</strong>
                <select className="input" value={form.status} disabled={fieldsDisabled}
                  onChange={event => setForm(current => ({
                    ...current, status: event.target.value as CreatorStatus
                  }))}>
                  <option value="ACTIVE">{tr('Actif', 'Active')}</option>
                  <option value="PAUSED">{tr('En pause', 'Paused')}</option>
                </select>
              </label>
            ) : null}

            {suspended ? <p role="alert" style={{ color: 'var(--orange)' }}>
              {tr('Cette page a été suspendue et ne peut pas être modifiée.',
                'This page is suspended and cannot be edited.')}
            </p> : null}
            {issue ? <p role="status" style={{ color: 'var(--muted)', margin: 0 }}>
              {issue === 'slug' ? tr('Choisis un identifiant valide.', 'Choose a valid identifier.')
                : issue === 'title' ? tr('Le titre doit avoir entre 2 et 80 caractères.',
                  'Title must be 2–80 characters.')
                  : tr('Vérifie les informations saisies.', 'Please review the form fields.')}
            </p> : null}
            <button className="btn btn-primary" disabled={disabled || Boolean(issue)}
              style={{ minHeight: 48, justifySelf: 'start' }}>
              {busy ? tr('Enregistrement…', 'Saving…') :
                profile ? tr('Enregistrer les modifications', 'Save changes') :
                  tr('Activer le mode créateur', 'Activate creator mode')}
            </button>
          </form>

          {dashboard ? (
            <section className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{tr('Mon audience', 'My audience')}</h2>
                <small style={{ color: 'var(--muted)' }}>
                  {tr('Derniers', 'Last')} {dashboard.windowDays} {tr('jours', 'days')}
                </small>
              </div>
              <div style={{ display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12, marginTop: 16 }}>
                {metricEntries.map(([key, value]) => (
                  <div className="card" key={key} style={{ padding: 14 }}>
                    <strong style={{ fontSize: 23 }}>{Number(value).toLocaleString(en ? 'en-US' : 'fr-FR')}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>
                      {METRIC_NAMES[key]?.[en ? 1 : 0] ?? key}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 0 }}>
                {tr('Mesures anonymisées, conservées pendant', 'Anonymous metrics retained for')}
                {' '}{dashboard.privacy.receiptRetentionDays}{' '}{tr('jours.', 'days.')}
              </p>
            </section>
          ) : statsUnavailable ? (
            <p role="status" style={{ color: 'var(--muted)' }}>
              {tr('Les statistiques sont temporairement indisponibles. Le profil reste modifiable.',
                'Statistics are temporarily unavailable. Your profile can still be edited.')}
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
