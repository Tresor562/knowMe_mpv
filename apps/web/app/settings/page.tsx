'use client';

import Link from 'next/link';
import { translate } from '@knowme/i18n-contract';
import { FormEvent, useState } from 'react';
import { useI18n } from '../../components/i18n-provider';
import { MediaDownloadSettings } from '../../components/media-download-settings';
import { apiFetch, clearSession } from '../../lib/api';
import { useSession } from '../../lib/use-session';

export default function SettingsPage() {
  const { user, loading } = useSession({ required: true });
  const { locale, version, persisted, syncLocale, t } = useI18n();
  const en = locale === 'en';
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);

  async function changeLanguage(nextLocale: 'fr' | 'en') {
    if (nextLocale === locale && persisted) return;
    setLanguageBusy(true);
    setMessage('');
    try {
      const saved = await syncLocale(nextLocale);
      setMessage(translate(saved.locale, 'settings.languageSaved'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : translate(nextLocale, 'settings.languageConflict'));
    } finally {
      setLanguageBusy(false);
    }
  }

  async function exportData() {
    setBusy(true);
    try {
      const data = await apiFetch<unknown>('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `knowme-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(en ? 'Your data export is ready.' : 'Ton export a été généré.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : (en ? 'Export unavailable.' : 'Export impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (!window.confirm(en ? 'This cannot be undone. Delete your KnowMe account?' : 'Cette action est définitive. Supprimer ton compte KnowMe ?')) return;
    setBusy(true);
    try {
      await apiFetch('/account', { method: 'DELETE', body: JSON.stringify({ password }) });
      clearSession();
      window.location.replace('/');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : (en ? 'Could not delete account.' : 'Suppression impossible.'));
      setBusy(false);
    }
  }

  if (loading || !user) return <main className="shell"><p>{t('common.loading')}</p></main>;

  return (
    <main className="shell km-settings-page">
      <header className="km-settings-header">
        <Link href="/profile" aria-label={en ? 'Back to profile' : 'Retour au profil'} className="km-settings-back">‹</Link>
        <div><h1>{t('settings.title')}</h1><p>@{user.username}</p></div>
      </header>
      {message && <p className="km-profile-notice" role="status">{message}</p>}

      <section className="km-settings-group" aria-label={en ? 'Account' : 'Compte'}>
        <h2>{en ? 'Account' : 'Compte'}</h2>
        <Link href="/profile" className="km-settings-row">
          <span>{en ? 'Edit profile and bio' : 'Modifier le profil et la bio'}</span><span>›</span>
        </Link>
        <Link href="/settings/appearance" className="km-settings-row">
          <span>{en ? 'Appearance and themes' : 'Apparence et thèmes'}</span><span>›</span>
        </Link>
        <Link href="/security" className="km-settings-row">
          <span>{en ? 'Security and privacy' : 'Sécurité et confidentialité'}</span><span>›</span>
        </Link>
        <Link href="/notifications" className="km-settings-row">
          <span>{en ? 'Notifications' : 'Notifications'}</span><span>›</span>
        </Link>
      </section>

      <section className="km-settings-group" aria-label={t('settings.languageTitle')}>
        <h2>{t('settings.languageTitle')}</h2>
        <div className="km-settings-language">
          <div className="km-settings-segments" role="group" aria-label={t('settings.languageTitle')}>
            <button type="button" aria-pressed={locale === 'fr'} className={locale === 'fr' ? 'selected' : ''}
              disabled={languageBusy} onClick={() => void changeLanguage('fr')}>{t('common.french')}</button>
            <button type="button" aria-pressed={locale === 'en'} className={locale === 'en' ? 'selected' : ''}
              disabled={languageBusy} onClick={() => void changeLanguage('en')}>{t('common.english')}</button>
          </div>
          <p>{t('settings.languageDescription')}</p>
          <small>{t('settings.languageFallback')} · v{version}{persisted ? '' : en ? ' · detected on this device' : ' · détectée sur cet appareil'}</small>
        </div>
      </section>

      <section className="km-settings-group">
        <h2>{en ? 'Storage and data' : 'Stockage et données'}</h2>
        <MediaDownloadSettings />
        <details className="km-settings-disclosure">
          <summary>
            <span>{en ? 'Export my data' : 'Exporter mes données'}</span>
            <small>{en ? 'Get a copy of your account information' : 'Télécharger les informations de ton compte'}</small>
          </summary>
          <div className="km-settings-disclosure-body">
            <p className="km-settings-hint">{en ? 'Download your KnowMe data in JSON format.' : 'Télécharge tes données KnowMe au format JSON.'}</p>
            <button type="button" className="btn" disabled={busy} onClick={() => void exportData()}>
              {busy ? (en ? 'Preparing…' : 'Préparation…') : en ? 'Download my export' : 'Télécharger mon export'}
            </button>
          </div>
        </details>
      </section>

      <section className="km-settings-group km-settings-danger">
        <h2>{en ? 'Danger zone' : 'Zone sensible'}</h2>
        <details className="km-settings-disclosure">
          <summary>
            <span>{en ? 'Delete my account' : 'Supprimer mon compte'}</span>
            <small>{en ? 'Permanent and irreversible' : 'Action définitive et irréversible'}</small>
          </summary>
          <form className="km-settings-disclosure-body" onSubmit={deleteAccount}>
            <p className="km-settings-hint">{en ? 'This action permanently deletes your account, subject to retention rules.' : 'Cette action supprime définitivement ton compte selon les règles de conservation.'}</p>
            <input name="password" type="password" autoComplete="current-password" required minLength={8}
              placeholder={en ? 'Confirm password' : 'Confirme ton mot de passe'} />
            <button type="submit" className="btn btn-accent" disabled={busy}>
              {en ? 'Permanently delete account' : 'Supprimer définitivement mon compte'}
            </button>
          </form>
        </details>
      </section>
    </main>
  );
}
