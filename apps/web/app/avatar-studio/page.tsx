'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AVATAR_LAYER_LABELS,
  AVATAR_LAYER_SLOTS,
  AvatarLayerSlot,
  AvatarManifest,
  AvatarStudioState,
  equipAvatarLayer,
  getAvatarStudio
} from '../../lib/avatar-studio';
import { useSession } from '../../lib/use-session';

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function AvatarPreview({ manifest }: { manifest: AvatarManifest }) {
  const visibleLayers = manifest.layers.filter((layer) => layer.item);
  return (
    <div
      aria-label="Aperçu de l’avatar composé"
      style={{
        position: 'relative',
        width: 'min(100%, 420px)',
        aspectRatio: '1 / 1',
        borderRadius: 36,
        overflow: 'hidden',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      {visibleLayers.length === 0 && manifest.legacyAvatarUrl ? (
        <img
          src={manifest.legacyAvatarUrl}
          alt="Avatar actuel"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
      {visibleLayers.length === 0 && !manifest.legacyAvatarUrl ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 82, fontWeight: 900 }}>{manifest.fallback.initials}</div>
          <small style={{ color: 'var(--muted)' }}>{manifest.fallback.paletteToken}</small>
        </div>
      ) : null}
      {visibleLayers.map((layer) => (
        <img
          key={`${layer.slot}:${layer.item!.id}:${layer.item!.version}`}
          src={layer.item!.assetUrl}
          alt={layer.item!.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: layer.zIndex,
            pointerEvents: 'none'
          }}
        />
      ))}
    </div>
  );
}

export default function AvatarStudioPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [studio, setStudio] = useState<AvatarStudioState | null>(null);
  const [busySlot, setBusySlot] = useState<AvatarLayerSlot | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setStudio(await getAvatarStudio());
      setMessage('');
    } catch (cause) {
      setMessage(errorMessage(cause, 'Le studio d’avatar est indisponible.'));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const inventoryBySlot = useMemo(() => {
    const result = new Map<AvatarLayerSlot, AvatarStudioState['inventory']>();
    if (!studio) return result;
    for (const slot of AVATAR_LAYER_SLOTS) {
      result.set(
        slot,
        studio.inventory.filter((entry) => entry.item.slot === slot)
      );
    }
    return result;
  }, [studio]);

  async function equip(slot: AvatarLayerSlot, itemId: string | null) {
    if (busySlot) return;
    setBusySlot(slot);
    setMessage('');
    try {
      const response = await equipAvatarLayer(slot, itemId);
      setStudio(response.studio);
      setMessage(
        itemId
          ? `${AVATAR_LAYER_LABELS[slot]} mis à jour.`
          : `${AVATAR_LAYER_LABELS[slot]} retiré.`
      );
    } catch (cause) {
      setMessage(errorMessage(cause, 'Modification impossible.'));
    } finally {
      setBusySlot(null);
    }
  }

  if (sessionLoading || !user || !studio) {
    return <main className="shell"><p>{message || 'Chargement du studio d’avatar…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>KMD-035 · STUDIO D’AVATAR</small>
        <h1>Compose ton identité visuelle</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 840 }}>
          Le studio assemble uniquement les objets présents dans ton inventaire KnowMe. Chaque couche
          est vérifiée et équipée par le serveur ; aucun asset arbitraire n’est accepté depuis le navigateur.
        </p>
      </header>

      {message ? <p role="status" style={{ color: 'var(--mint)' }}>{message}</p> : null}

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(300px, 440px) minmax(0, 1fr)',
          alignItems: 'start',
          marginTop: 24
        }}
      >
        <aside className="card" style={{ padding: 20, position: 'sticky', top: 20 }}>
          <AvatarPreview manifest={studio.manifest} />
          <div style={{ marginTop: 16 }}>
            <strong>{studio.profile.displayName}</strong>
            <div style={{ color: 'var(--muted)' }}>@{studio.profile.username}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Link className="btn" href={`/profile/${studio.profile.username}`}>
              Profil public
            </Link>
            <Link className="btn" href="/privacy/cosmetics">
              Confidentialité
            </Link>
            <Link className="btn" href="/cosmetics">
              Inventaire complet
            </Link>
          </div>
        </aside>

        <section className="grid">
          {AVATAR_LAYER_SLOTS.map((slot) => {
            const items = inventoryBySlot.get(slot) ?? [];
            const equipped = studio.equipment.find((entry) => entry.slot === slot)?.item ?? null;
            return (
              <article key={slot} className="card" style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <small style={{ color: 'var(--muted)' }}>{slot}</small>
                    <h2 style={{ margin: '4px 0' }}>{AVATAR_LAYER_LABELS[slot]}</h2>
                  </div>
                  <button
                    className="btn"
                    disabled={!equipped || busySlot !== null}
                    onClick={() => void equip(slot, null)}
                  >
                    {busySlot === slot ? 'Mise à jour…' : 'Retirer la couche'}
                  </button>
                </div>

                {items.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>
                    Aucun objet de cette couche dans ton inventaire. Les objets compatibles peuvent
                    être obtenus via les récompenses, événements ou offres cosmétiques autoritaires.
                  </p>
                ) : (
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}
                  >
                    {items.map((entry) => {
                      const selected = equipped?.id === entry.item.id;
                      return (
                        <button
                          key={entry.id}
                          className="card"
                          disabled={busySlot !== null}
                          onClick={() => void equip(slot, entry.item.id)}
                          style={{
                            padding: 12,
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderColor: selected ? 'var(--mint)' : undefined,
                            background: selected ? 'var(--surface-2)' : undefined
                          }}
                        >
                          <div
                            style={{
                              aspectRatio: '1 / 1',
                              borderRadius: 18,
                              overflow: 'hidden',
                              background: 'var(--surface-2)',
                              display: 'grid',
                              placeItems: 'center'
                            }}
                          >
                            <img
                              src={entry.item.previewUrl ?? entry.item.assetUrl}
                              alt={entry.item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                          <strong style={{ display: 'block', marginTop: 10 }}>
                            {entry.item.name}
                          </strong>
                          <small style={{ color: selected ? 'var(--mint)' : 'var(--muted)' }}>
                            {selected ? 'Équipé' : entry.item.rarity}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          <section className="card" style={{ padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Garanties du rendu</h2>
            <p style={{ color: 'var(--muted)' }}>
              Le manifest est résolu côté serveur, dans un ordre de couches stable. Les assets retirés
              retombent sur un fallback sûr, et la visibilité publique suit les réglages cosmétiques du profil.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
