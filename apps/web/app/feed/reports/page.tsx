'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
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

type ReportPage = { reports: ReportRecord[]; nextCursor: string | null };
type ReportStatusFilter = '' | 'OPEN' | 'RESOLVED' | 'DISMISSED';

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
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const generation = useRef(0);
  const pageInFlight = useRef(false);

  const reload = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError('');
    setMoreError('');
    setLoadingMore(false);
    try {
      const url = statusFilter
        ? `/reports/mine/posts?status=${statusFilter}`
        : '/reports/mine/posts';
      const result = await apiFetch<ReportPage>(url);
      if (requestId !== generation.current) return;
      setRecords(result.reports);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      if (requestId !== generation.current) return;
      setRecords([]);
      setNextCursor(null);
      setError(cause instanceof Error ? cause.message :
        (en ? 'Your reports are temporarily unavailable.' : 'Impossible de charger tes signalements.'));
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [en, statusFilter]);

  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore || pageInFlight.current) return;
    const requestId = generation.current;
    pageInFlight.current = true;
    setLoadingMore(true);
    setMoreError('');
    try {
      const result = await apiFetch<ReportPage>(
        `/reports/mine/posts?cursor=${encodeURIComponent(nextCursor)}${statusFilter ? `&status=${statusFilter}` : ''}`
      );
      if (generation.current !== requestId) return;
      setRecords(previous => {
        const known = new Set(previous.map(item => item.id));
        return [...previous, ...result.reports.filter(item => !known.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (cause) {
      if (generation.current === requestId) {
        setMoreError(cause instanceof Error ? cause.message :
          (en ? 'Could not load more reports.' : 'Chargement des signalements suivants impossible.'));
      }
    } finally {
      pageInFlight.current = false;
      if (generation.current === requestId) setLoadingMore(false);
    }
  };

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
        <Link href="/feed" aria-label={en ? 'Back to feed' : 'Retour au fil'}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m14.5 5-7 7 7 7" />
          </svg>
        </Link>
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
          ? 'Your publication reports appear here, newest first. Reporting does not remove a publication.'
          : 'Retrouve ici tes signalements de publications, des plus récents aux plus anciens. Un signalement ne supprime pas une publication.'}
      </p>
      <div className="km-post-report-history-filters" role="group"
        aria-label={en ? 'Filter report status' : 'Filtrer par statut'}>
        {([
          ['', en ? 'All' : 'Tous'],
          ['OPEN', en ? 'Under review' : 'En cours'],
          ['RESOLVED', en ? 'Reviewed' : 'Examinés'],
          ['DISMISSED', en ? 'Closed' : 'Clôturés']
        ] as const).map(([value, label]) => (
          <button key={value || 'all'} type="button"
            aria-pressed={statusFilter === value}
            disabled={sessionLoading}
            onClick={() => {
              if (statusFilter !== value) {
                setLoading(true);
                setStatusFilter(value);
              }
            }}>{label}</button>
        ))}
      </div>
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
          <h2>{statusFilter
            ? (en ? 'No reports with this status' : 'Aucun signalement avec ce statut')
            : (en ? 'No publication reports in your recent history' :
              'Aucun signalement de publication dans ton historique récent')}</h2>
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
                <strong className="km-post-report-history-status" data-status={record.status}>
                  {reportStatus(record.status, en)}
                </strong>
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
      {!loading && !error && moreError ? (
        <p role="alert" className="km-post-report-history-error">{moreError}</p>
      ) : null}
      {!loading && !error && nextCursor ? (
        <button type="button" className="km-post-report-history-more"
          disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? (en ? 'Loading…' : 'Chargement…') :
            (en ? 'Show more reports' : 'Afficher plus de signalements')}
        </button>
      ) : null}
    </main>
  );
}
