'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import {
  DEFAULT_CIRCLE_NOTIFICATION_PREFERENCE,
  clockToMinute, minuteToClock, profileCirclePreferenceError,
  profileCirclePreferencePayload, toggleCircleMuted,
  type ProfileCircleNotificationPreference as Preference
} from '../../../lib/profile-circle-notification-editor';

type CircleEntry = {
  circle: { id: string; name: string; type: string; status: string };
  membership: { role: string; status: string };
};

type BooleanPreferenceKey =
  | 'enabled' | 'invitationsEnabled' | 'membershipEnabled'
  | 'governanceEnabled' | 'contentEnabled' | 'familyEnabled' | 'realtimeEnabled';

const OPTIONS: Array<{
  key: BooleanPreferenceKey;
  label: [string, string];
  description: [string, string];
}> = [
  { key: 'enabled', label: ['Notifications facultatives', 'Optional notifications'],
    description: ['Interrupteur général des alertes non obligatoires.', 'Main switch for nonessential alerts.'] },
  { key: 'invitationsEnabled', label: ['Invitations', 'Invitations'],
    description: ['Duo, famille, équipe et guilde.', 'Duos, family, teams and guilds.'] },
  { key: 'membershipEnabled', label: ['Membres', 'Membership'],
    description: ['Départs, adhésions et demandes.', 'Members, departures and requests.'] },
  { key: 'governanceEnabled', label: ['Gestion des relations', 'Circle governance'],
    description: ['Évolution et changements facultatifs.', 'Optional management and evolution updates.'] },
  { key: 'contentEnabled', label: ['Publications et stories', 'Content and stories'],
    description: ['Activité des contenus collectifs.', 'Activity on shared content.'] },
  { key: 'familyEnabled', label: ['Famille', 'Family'],
    description: ['Propositions de liens familiaux.', 'Family relationship proposals.'] },
  { key: 'realtimeEnabled', label: ['Alertes instantanées', 'Live alerts'],
    description: ['Désactiver ne supprime pas les éléments de la boîte.', 'Turning off does not delete inbox items.'] }
];

const COMMON_ZONES = [
  'UTC', 'Africa/Porto-Novo', 'Africa/Abidjan', 'Africa/Lagos',
  'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Tokyo'
];

export default function ProfileCircleNotificationSettingsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [preference, setPreference] = useState<Preference>(DEFAULT_CIRCLE_NOTIFICATION_PREFERENCE);
  const [saved, setSaved] = useState<Preference | null>(null);
  const [circles, setCircles] = useState<CircleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [circleError, setCircleError] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setMessage('');
    setMessageError(false);
    try {
      // The preference GET is authoritative. Never present defaults as if
      // they were the user's existing settings when this request fails.
      const stored = await apiFetch<Preference>('/profile-circle-notification-preferences/me');
      setPreference(stored);
      setSaved(stored);
      setCircleError(false);
      try {
        setCircles(await apiFetch<CircleEntry[]>('/profile-circles/me'));
      } catch {
        setCircles([]);
        setCircleError(true);
      }
    } catch (cause) {
      setSaved(null);
      setLoadError(true);
      setMessage(cause instanceof Error ? cause.message : 'Preferences unavailable.');
      setMessageError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user?.id]);

  function update(patch: Partial<Preference>) {
    setPreference(current => ({ ...current, ...patch }));
    setMessage('');
    setMessageError(false);
  }

  function changeClock(key: 'quietStartMinute' | 'quietEndMinute' | 'digestMinuteOfDay', input: string) {
    const minute = clockToMinute(input);
    if (minute !== null) update({ [key]: minute });
  }

  function changeMute(circleId: string) {
    setPreference(current => toggleCircleMuted(current, circleId));
    setMessage('');
    setMessageError(false);
  }

  const unsaved = saved !== null && JSON.stringify(preference) !== JSON.stringify(saved);
  const issue = profileCirclePreferenceError(preference);
  const locked = saving || loading || loadError || saved === null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !unsaved || issue) return;
    setSaving(true);
    setMessage('');
    setMessageError(false);
    try {
      const payload = profileCirclePreferencePayload(preference);
      const confirmed = await apiFetch<Preference>('/profile-circle-notification-preferences/me', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setPreference(confirmed);
      setSaved(confirmed);
      setMessage(tr('Préférences enregistrées.', 'Preferences saved.'));
    } catch (cause) {
      // Keep the draft and allow explicit retry; do not replace it with defaults.
      setMessage(cause instanceof Error ? cause.message :
        tr('Enregistrement impossible.', 'Could not save preferences.'));
      setMessageError(true);
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>{tr('Chargement…', 'Loading…')}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 850, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <Link href="/settings" style={{ color: 'var(--mint)', fontWeight: 750 }}>
          ← {tr('Paramètres', 'Settings')}
        </Link>
        <h1 style={{ margin: 0 }}>{tr('Notifications des relations', 'Circle notifications')}</h1>
        <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          {tr(
            'Choisis les alertes, les heures silencieuses et les résumés. Les événements importants restent disponibles dans la boîte.',
            'Choose alerts, quiet hours and daily digests. Important events remain available in your inbox.'
          )}
        </p>
      </header>

      {message ? <p role={messageError ? 'alert' : 'status'}
        style={{ color: messageError ? 'var(--orange)' : 'var(--mint)', margin: 0 }}>
        {message}
      </p> : null}

      {loading ? (
        <section className="card" role="status" style={{ padding: 18 }}>
          {tr('Chargement de tes préférences…', 'Loading your preferences…')}
        </section>
      ) : loadError ? (
        <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
          <p style={{ margin: 0 }}>
            {tr('Lecture impossible. Aucun réglage par défaut ne sera enregistré à ta place.',
              'Settings could not be loaded. Defaults will not overwrite your choices.')}
          </p>
          <button type="button" className="btn" onClick={() => void load()}>
            {tr('Réessayer', 'Retry')}
          </button>
        </section>
      ) : (
        <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
          <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{tr('Types d’alertes', 'Notification types')}</h2>
            {OPTIONS.map(({ key, label, description }, index) => (
              <label key={key} style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 16, padding: '9px 0',
                borderBottom: index < OPTIONS.length - 1 ? '1px solid var(--border)' : undefined }}>
                <span style={{ display: 'grid', gap: 4 }}>
                  <strong>{label[en ? 1 : 0]}</strong>
                  <small style={{ color: 'var(--muted)' }}>{description[en ? 1 : 0]}</small>
                </span>
                <input type="checkbox" disabled={locked} checked={preference[key]}
                  onChange={event => update({ [key]: event.target.checked })} />
              </label>
            ))}
          </section>

          <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17 }}>
                {tr('Heures silencieuses', 'Quiet hours')}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 0 }}>
                {tr('Les alertes facultatives attendent la fin de cette plage ; les alertes de sécurité restent prioritaires.',
                  'Optional alerts wait until this window ends; important safety alerts remain prioritized.')}
              </p>
            </div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
              <strong>{tr('Activer les heures silencieuses', 'Enable quiet hours')}</strong>
              <input type="checkbox" disabled={locked} checked={preference.quietHoursEnabled}
                onChange={event => update({ quietHoursEnabled: event.target.checked })} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                {tr('Début', 'Start')}
                <input className="input" type="time" disabled={locked || !preference.quietHoursEnabled}
                  value={minuteToClock(preference.quietStartMinute)}
                  onChange={event => changeClock('quietStartMinute', event.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                {tr('Fin', 'End')}
                <input className="input" type="time" disabled={locked || !preference.quietHoursEnabled}
                  value={minuteToClock(preference.quietEndMinute)}
                  onChange={event => changeClock('quietEndMinute', event.target.value)} />
              </label>
            </div>
            {preference.quietHoursEnabled &&
              preference.quietStartMinute === preference.quietEndMinute ? (
                <small style={{ color: 'var(--orange)' }}>
                  {tr('Attention : des heures identiques rendent toute la journée silencieuse.',
                    'Heads up: equal start and end times mute the entire day.')}
                </small>
              ) : null}
            <label style={{ display: 'grid', gap: 6 }}>
              {tr('Fuseau horaire (IANA)', 'Time zone (IANA)')}
              <input className="input" list="km-circle-timezones"
                value={preference.timezone} maxLength={80} disabled={locked}
                autoCapitalize="none" spellCheck={false}
                onChange={event => update({ timezone: event.target.value })} />
              <datalist id="km-circle-timezones">
                {COMMON_ZONES.map(zone => <option key={zone} value={zone} />)}
              </datalist>
            </label>
          </section>

          <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>
              {tr('Résumé des notifications', 'Notification digest')}
            </h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>
              {tr('Regroupe les alertes facultatives dans un récapitulatif quotidien.',
                'Group optional alerts into a daily summary.')}
            </p>
            <div role="group" aria-label={tr('Fréquence du résumé', 'Digest frequency')}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['OFF', 'DAILY'] as const).map(mode => (
                <button key={mode} type="button"
                  aria-pressed={preference.digestMode === mode}
                  className={preference.digestMode === mode ? 'btn btn-primary' : 'btn'}
                  disabled={locked} onClick={() => update({ digestMode: mode })}>
                  {mode === 'OFF' ? tr('Désactivé', 'Off') : tr('Chaque jour', 'Every day')}
                </button>
              ))}
            </div>
            <label style={{ display: 'grid', gap: 6, maxWidth: 240 }}>
              {tr('Heure du résumé', 'Digest time')}
              <input className="input" type="time" disabled={locked || preference.digestMode === 'OFF'}
                value={minuteToClock(preference.digestMinuteOfDay)}
                onChange={event => changeClock('digestMinuteOfDay', event.target.value)} />
            </label>
          </section>

          <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>
              {tr('Relations silencieuses', 'Muted circles')}
            </h2>
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: 12 }}>
              {tr('Les notifications facultatives des structures silencieuses restent coupées.',
                'Optional notifications from muted circles are hidden.')}
            </p>
            {circleError ? <p role="status" style={{ color: 'var(--orange)', margin: 0 }}>
              {tr('Liste des relations indisponible, mais les autres réglages restent accessibles.',
                'Circle list is unavailable, but you can still edit other settings.')}
            </p> : !circles.length ? <p style={{ color: 'var(--muted)', margin: 0 }}>
              {tr('Aucune relation à configurer.', 'No circles to configure.')}
            </p> : null}
            <div style={{ display: 'grid', gap: 6 }}>
              {circles.map(({ circle, membership }) => {
                const muted = preference.mutedCircleIds.includes(circle.id);
                return <button key={circle.id} type="button"
                  disabled={locked} aria-pressed={muted}
                  aria-label={tr(`Rendre ${circle.name} ${muted ? 'active' : 'silencieuse'}`,
                    `Turn ${muted ? 'on' : 'off'} notifications for ${circle.name}`)}
                  onClick={() => changeMute(circle.id)}
                  style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: 12, padding: '12px 10px',
                    borderRadius: 14, border: '1px solid var(--border)',
                    color: 'var(--text)', background: 'transparent', textAlign: 'left' }}>
                  <span style={{ display: 'grid', gap: 3 }}>
                    <strong>{circle.name}</strong>
                    <small style={{ color: 'var(--muted)' }}>{circle.type} · {membership.role}</small>
                  </span>
                  <span style={{ fontWeight: 700, color: muted ? 'var(--muted)' : 'var(--mint)' }}>
                    {muted ? tr('Silencieuse', 'Muted') : tr('Active', 'On')}
                  </span>
                </button>;
              })}
            </div>
          </section>

          {issue ? <p role="alert" style={{ color: 'var(--orange)', margin: 0 }}>
            {issue === 'timezone'
              ? tr('Saisis un fuseau IANA valide (ex. Africa/Porto-Novo).',
                'Enter a valid IANA time zone (e.g. Africa/Porto-Novo).')
              : tr('Vérifie les heures et les paramètres du résumé.',
                'Review quiet hours and digest settings.')}
          </p> : null}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={locked || !unsaved || Boolean(issue)}
              style={{ minHeight: 46 }}>
              {saving ? tr('Enregistrement…', 'Saving…') :
                tr('Enregistrer les préférences', 'Save preferences')}
            </button>
            <button type="button" className="btn" disabled={locked || !unsaved}
              onClick={() => { if (saved) { setPreference(saved); setMessage(''); } }}>
              {tr('Annuler les changements', 'Discard changes')}
            </button>
            {unsaved ? <small role="status" style={{ color: 'var(--orange)' }}>
              {tr('Modifications non enregistrées', 'Unsaved changes')}
            </small> : null}
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            {tr('Les alertes obligatoires de sécurité, de rôle et de modération sont toujours conservées.',
              'Mandatory security, role and moderation alerts are always retained.')}
          </p>
        </form>
      )}
    </main>
  );
}
