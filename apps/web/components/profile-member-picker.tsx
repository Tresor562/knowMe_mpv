'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

export type ProfileMemberOption = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  relationship: {
    friendshipStatus: string | null;
    membershipStatus: string | null;
    membershipRole: string | null;
  };
};

type DirectoryResponse = {
  query: string;
  results: ProfileMemberOption[];
  privacy: {
    serverSelectedFields: boolean;
    emailOmitted: boolean;
    knowCoinsOmitted: boolean;
    walletOmitted: boolean;
    suspendedAccountsOmitted: boolean;
  };
};

export function ProfileMemberPicker(props: {
  selected: ProfileMemberOption[];
  onChange: (members: ProfileMemberOption[]) => void;
  maximum: number;
  circleId?: string;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileMemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedIds = useMemo(
    () => new Set(props.selected.map((member) => member.id)),
    [props.selected]
  );

  useEffect(() => {
    const normalized = query.trim().replace(/^@+/, '');
    if (normalized.length < 2) {
      setResults([]);
      setMessage('');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: normalized, limit: '12' });
        if (props.circleId) params.set('circleId', props.circleId);
        const response = await apiFetch<DirectoryResponse>(
          `/profile-member-directory?${params.toString()}`
        );
        if (!cancelled) {
          setResults(response.results);
          setMessage(
            response.results.length === 0 ? 'Aucun membre correspondant.' : ''
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setMessage(
            cause instanceof Error ? cause.message : 'Recherche indisponible.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [props.circleId, query]);

  function add(member: ProfileMemberOption) {
    if (selectedIds.has(member.id) || props.selected.length >= props.maximum) return;
    props.onChange([...props.selected, member]);
  }

  function remove(memberId: string) {
    props.onChange(props.selected.filter((member) => member.id !== memberId));
  }

  return (
    <div className="grid">
      <label htmlFor="member-search">
        {props.label ?? 'Rechercher des personnes par pseudo ou nom'}
      </label>
      <input
        id="member-search"
        className="input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="@pseudo ou nom affiché"
        autoComplete="off"
      />
      <small style={{ color: 'var(--muted)' }}>
        {props.selected.length}/{props.maximum} sélectionné(s). La recherche ne révèle
        ni email, ni KnowCoins, ni activité privée.
      </small>

      {props.selected.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {props.selected.map((member) => (
            <button
              type="button"
              className="btn"
              key={member.id}
              onClick={() => remove(member.id)}
              title="Retirer de la sélection"
            >
              {member.displayName} · @{member.username} ×
            </button>
          ))}
        </div>
      )}

      {loading && <small>Recherche…</small>}
      {message && <small style={{ color: 'var(--muted)' }}>{message}</small>}

      {results.length > 0 && (
        <div className="grid">
          {results.map((member) => {
            const selected = selectedIds.has(member.id);
            const unavailable =
              selected ||
              props.selected.length >= props.maximum ||
              ['ACTIVE', 'INVITED'].includes(
                member.relationship.membershipStatus ?? ''
              );
            return (
              <button
                type="button"
                className="card"
                key={member.id}
                disabled={unavailable}
                onClick={() => add(member)}
                style={{
                  padding: 14,
                  textAlign: 'left',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--surface-2)',
                    fontWeight: 900
                  }}
                >
                  {member.displayName[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{member.displayName}</strong>
                  <div style={{ color: 'var(--muted)' }}>@{member.username}</div>
                  <small>
                    {member.relationship.membershipStatus
                      ? `Déjà ${member.relationship.membershipStatus.toLowerCase()}`
                      : member.relationship.friendshipStatus === 'ACCEPTED'
                        ? 'Ami KnowMe'
                        : 'Profil KnowMe'}
                  </small>
                </div>
                <span>{selected ? 'Sélectionné' : unavailable ? 'Indisponible' : 'Ajouter'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
