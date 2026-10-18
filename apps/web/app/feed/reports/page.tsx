'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import './reports.css';

type ReportRecord = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
};

function reportStatus(value: string, en: boolean) {
  if (value === 'OPEN') return en ? 'Under review' : 'En cours d’examen';
  if (value === 'RESOLVED') return en ? 'Reviewed' : 'Examiné';
  if (value === 'DISMISSED') return en ? 'Closed' : 'Clôturé';
  return en ? 'Status available in your account' : 'Statut disponible dans ton compte';
}

/** A private account-only view; the API decides visibility and report status. */
export default function MyPostReportsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<ReportRecord[]>('/reports/mine');
      setRecords(Array.isArray(result) ? result.filter(item => item.targetType === 'POST') : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message :
        (en ? 'Your reports are temporarily unavailable.' : 'Impossible de charger tes signalements.'));
    } finally {
      setLoading(false);
    }
  }, [en]);

  useEffect(() => {
    if (!sessionLoading && user) void reload();
  }, [sessionLoading, user?.id, reload]);

  const heading = en ? 'My publication reports' : 'Mes signalements de publications';
  if (sessionLoading || !user) {
    return <main className="shell km-post-report-history">
      <p role="status">{en ? 'Loading your account…' : 'Chargement du compte…'}</p>
    </main>;
  }

  return (
    <main className="shell km-post-report-history">
      <header className="km-post-report-history-head">
        <Link href="/feed" aria-label={en ? 'Back to feed' : 'Retour au fil'}>‹</Link>
        <div>
          <h1>{heading}</h1>
          <p>{en ? 'Private to your account' : 'Visible uniquement par ton compte'}</p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={loading}
          aria-label={en ? 'Refresh reports' : 'Actualiser les signalements'}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M20 7v5h-5M4 17v-5h5"/>
            <path d="M5.8 9.2A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.2-2.2"/>
          </svg>
        </button>
      </header>
      <p className="km-post-report-history-note">
        {en
          ? 'The moderation service provides your 50 latest reports across all categories. Publication reports from that list appear below. Sending a report does not remove a post.'
          : 'Le service affiche tes 50 derniers signalements, toutes catégories confondues. Ceux concernant des publications figurent ci-dessous. Signaler une publication ne la supprime pas.'}
      </p>
      {loading ? <p role="status">{en ? 'Loading reports…' : 'Chargement des signalements…'}</p> : null}
      {error ? (
        <div className="km-post-report-history-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void reload()}>
            {en ? 'Retry' : 'Réessayer'}
          </button>
        </div>
      ) : null}
      {!loading && !error && records.length === 0 ? (
        <section className="km-post-report-history-empty" aria-label={heading}>
          <h2>{en ? 'No publication reports in your recent history' :
            'Aucun signalement de publication dans ton historique récent'}</h2>
          <p>{en ? 'Reports submitted for publications will appear here once confirmed.' :
            'Les signalements confirmés de publications apparaîtront ici.'}</p>
          <Link href="/feed">{en ? 'Return to publications' : 'Retour aux publications'}</Link>
        </section>
      ) : null}
      {!loading && !error && records.length > 0 ? (
        <ol className="km-post-report-history-list">
          {records.map(record => (
            <li key={record.id}>
              <div className="km-post-report-history-meta">
                <strong>{reportStatus(record.status, en)}</strong>
                <time dateTime={record.createdAt}>
                  {new Date(record.createdAt).toLocaleString(en ? 'en-US' : 'fr-FR')}
                </time>
              </div>
              <p>{record.reason}</p>
              <Link href={`/feed/${encodeURIComponent(record.targetId)}`}>
                {en ? 'View publication (if still available)' : 'Voir la publication (si disponible)'}
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}
