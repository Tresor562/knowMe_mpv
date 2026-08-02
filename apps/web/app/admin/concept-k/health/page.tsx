'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type HealthItem = {
  asset: {
    id: string;
    key: string;
    version: number;
    eventKey: string;
    active: boolean;
    quarantinedAt: string | null;
    quarantineReason: string | null;
    quarantineSource: string | null;
    restoredAt: string | null;
    character: { key: string; displayName: string };
  };
  health: {
    totalSamples: number;
    failureSamples: number;
    successSamples: number;
    failureRate: number;
    averageDurationMs: number;
    windowHours: number;
  };
};

type HealthResponse = {
  items: HealthItem[];
  policy: {
    healthWindowHours: number;
    minimumSamples: number;
    minimumFailures: number;
    failureRateThreshold: number;
    oneSamplePerAccountAssetDay: boolean;
    automaticFallback: boolean;
    premiumBypassAllowed: boolean;
  };
};

export default function ConceptKHealthPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [data, setData] = useState<HealthResponse | null>(null);
  const [reasonByAsset, setReasonByAsset] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<HealthResponse>('/admin/concept-k/assets/health'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Santé Concept K indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function restore(event: FormEvent, assetId: string) {
    event.preventDefault();
    const reason = reasonByAsset[assetId]?.trim();
    if (!reason || reason.length < 8) {
      setMessage('Une raison de restauration explicite est requise.');
      return;
    }
    try {
      await apiFetch(`/admin/concept-k/assets/${assetId}/restore`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      });
      setMessage('Asset restauré. Les prochaines résolutions peuvent de nouveau le sélectionner.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Restauration impossible.');
    }
  }

  if (sessionLoading || !user || !data) {
    return <main className="shell"><p>{message || 'Chargement de la santé Concept K…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>CONCEPT K · DELIVERY HEALTH</small>
        <h1>Quarantaine et fallbacks</h1>
        <p style={{ color: 'var(--muted)' }}>
          Un compte ne fournit qu’un échantillon par asset et par jour. La quarantaine exige un
          seuil collectif et bascule immédiatement les utilisateurs vers le fallback statique.
        </p>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 20, marginBottom: 22 }}>
        <h2>Politique active</h2>
        <p>
          Fenêtre : {data.policy.healthWindowHours} h · Minimum : {data.policy.minimumSamples} échantillons ·
          Échecs : {data.policy.minimumFailures} · Taux : {Math.round(data.policy.failureRateThreshold * 100)} %
        </p>
        <p>Fallback automatique : oui · Bypass Premium : non.</p>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        {data.items.map(({ asset, health }) => (
          <article className="card" style={{ padding: 20 }} key={asset.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <h2>{asset.character.displayName} · {asset.key} v{asset.version}</h2>
                <p>{asset.eventKey} · {asset.active ? 'Actif' : 'Inactif'}</p>
                <p>
                  {health.totalSamples} échantillon(s) · {health.failureSamples} échec(s) ·
                  {Math.round(health.failureRate * 100)} % · moyenne {health.averageDurationMs} ms
                </p>
                {asset.quarantinedAt && (
                  <p style={{ color: 'var(--danger)' }}>
                    Quarantaine depuis {new Date(asset.quarantinedAt).toLocaleString('fr-FR')} ·
                    {asset.quarantineReason}
                  </p>
                )}
              </div>
              {asset.quarantinedAt && (
                <form onSubmit={(event) => void restore(event, asset.id)} style={{ minWidth: 300 }}>
                  <label>
                    Raison après vérification/correction
                    <textarea
                      minLength={8}
                      required
                      value={reasonByAsset[asset.id] ?? ''}
                      onChange={(event) =>
                        setReasonByAsset((current) => ({
                          ...current,
                          [asset.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <button className="btn btn-primary" type="submit">Restaurer l’asset</button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
