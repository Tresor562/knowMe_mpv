'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type CosmeticItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  slot: string;
  rarity: string;
  previewUrl: string | null;
};

type Ownership = {
  id: string;
  itemId: string;
  item: CosmeticItem;
};

type Equipment = {
  slot: string;
  itemId: string;
  item: CosmeticItem;
};

type PresetItem = {
  id: string;
  slot: string;
  itemId: string;
  position: number;
  item: CosmeticItem;
};

type Preset = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: PresetItem[];
};

type PresetResponse = {
  presets: Preset[];
  state: {
    defaultPresetId: string | null;
    activePresetId: string | null;
    activationVersion: number;
  };
  maintenance: { removedInvalidItems: number };
  rules: {
    visualOnly: boolean;
    atomicActivation: boolean;
    idempotentActivation: boolean;
    hiddenSlotsRespected: boolean;
    unavailableItemsPruned: boolean;
    supportedSlots: string[];
  };
};

type PreviewResponse = {
  preset: Preset;
  preview: Array<{
    slot: string;
    item: CosmeticItem;
    applicable: boolean;
    blockedReason: 'HIDDEN_SLOT' | null;
  }>;
  maintenance: { removedInvalidItems: number };
};

type InventoryResponse = {
  inventory: Ownership[];
  equipment: Equipment[];
  rules: { supportedSlots: string[] };
};

const SLOT_LABELS: Record<string, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_BACKGROUND: 'Fond de profil',
  CHAT_BUBBLE: 'Bulle de discussion',
  PROFILE_BADGE: 'Accent de badge'
};

function newIdempotencyKey(presetId: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cosmetic-preset-${presetId}-${random}`;
}

export default function CosmeticPresetsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [presets, setPresets] = useState<PresetResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [presetResponse, inventoryResponse] = await Promise.all([
        apiFetch<PresetResponse>('/cosmetics/presets'),
        apiFetch<InventoryResponse>('/cosmetics/me')
      ]);
      setPresets(presetResponse);
      setInventory(inventoryResponse);
      setSelected((current) => {
        if (Object.keys(current).length) return current;
        return Object.fromEntries(
          inventoryResponse.equipment.map((entry) => [entry.slot, entry.itemId])
        );
      });
      if (presetResponse.maintenance.removedInvalidItems > 0) {
        setMessage(
          `${presetResponse.maintenance.removedInvalidItems} objet(s) indisponible(s) ont été retirés automatiquement des presets.`
        );
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Presets cosmétiques indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const ownedBySlot = useMemo(() => {
    const grouped = new Map<string, Ownership[]>();
    for (const ownership of inventory?.inventory ?? []) {
      const entries = grouped.get(ownership.item.slot) ?? [];
      entries.push(ownership);
      grouped.set(ownership.item.slot, entries);
    }
    return grouped;
  }, [inventory]);

  async function createPreset() {
    const items = Object.entries(selected)
      .filter(([, itemId]) => Boolean(itemId))
      .map(([slot, itemId]) => ({ slot, itemId }));
    if (!name.trim() || !items.length) {
      setMessage('Donne un nom au preset et sélectionne au moins un objet.');
      return;
    }

    setBusy('create');
    try {
      await apiFetch('/cosmetics/presets', {
        method: 'POST',
        body: JSON.stringify({ name, items, setAsDefault })
      });
      setName('');
      setSetAsDefault(false);
      setMessage('Preset enregistré. Les objets restent purement visuels.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Création du preset impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function previewPreset(presetId: string) {
    setBusy(`preview:${presetId}`);
    try {
      const response = await apiFetch<PreviewResponse>(
        `/cosmetics/presets/${encodeURIComponent(presetId)}/preview`
      );
      setPreview(response);
      setMessage(
        response.maintenance.removedInvalidItems
          ? 'La prévisualisation a retiré des objets devenus indisponibles.'
          : 'Prévisualisation calculée par le serveur.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Prévisualisation impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function activatePreset(presetId: string) {
    setBusy(`activate:${presetId}`);
    try {
      const response = await apiFetch<{
        replayed: boolean;
        maintenance?: { skippedHiddenSlots: string[]; prunedInvalidItems: number };
      }>(`/cosmetics/presets/${encodeURIComponent(presetId)}/activate`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: newIdempotencyKey(presetId) })
      });
      const hidden = response.maintenance?.skippedHiddenSlots.length ?? 0;
      setMessage(
        hidden
          ? `Thème activé atomiquement. ${hidden} slot(s) masqué(s) n’ont pas été équipés.`
          : response.replayed
            ? 'Activation déjà appliquée sans doublon.'
            : 'Thème activé atomiquement sur tous les appareils.'
      );
      setPreview(null);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Activation impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function makeDefault(presetId: string) {
    setBusy(`default:${presetId}`);
    try {
      await apiFetch(`/cosmetics/presets/${encodeURIComponent(presetId)}/default`, {
        method: 'POST'
      });
      setMessage('Preset défini par défaut.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function removePreset(presetId: string) {
    setBusy(`delete:${presetId}`);
    try {
      await apiFetch(`/cosmetics/presets/${encodeURIComponent(presetId)}`, {
        method: 'DELETE'
      });
      setPreview((current) => current?.preset.id === presetId ? null : current);
      setMessage('Preset supprimé. L’historique d’activation reste auditable.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusy(null);
    }
  }

  if (sessionLoading || !user || !presets || !inventory) {
    return <main className="shell"><p>{message || 'Chargement des thèmes cosmétiques…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1060, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>KMD-030 · THÈMES SYNCHRONISÉS</small>
        <h1>Presets cosmétiques</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 780 }}>
          Compose plusieurs objets déjà possédés, prévisualise le résultat puis active le thème
          en une seule transaction. Aucun preset ne change l’XP, les scores, les prix ou la visibilité du profil.
        </p>
        <a className="btn" href="/cosmetics">Retour à l’inventaire</a>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 22, marginTop: 22 }}>
        <h2>Nouveau preset</h2>
        <label style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          Nom
          <input
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Nuit Nexus"
          />
        </label>

        <div style={{ display: 'grid', gap: 14 }}>
          {inventory.rules.supportedSlots.map((slot) => (
            <label key={slot} style={{ display: 'grid', gap: 8 }}>
              {SLOT_LABELS[slot] ?? slot}
              <select
                value={selected[slot] ?? ''}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [slot]: event.target.value }))
                }
              >
                <option value="">Aucun objet</option>
                {(ownedBySlot.get(slot) ?? []).map((ownership) => (
                  <option key={ownership.id} value={ownership.itemId}>
                    {ownership.item.name} · {ownership.item.rarity}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
          <input
            type="checkbox"
            checked={setAsDefault}
            onChange={(event) => setSetAsDefault(event.target.checked)}
          />
          Utiliser comme preset par défaut
        </label>

        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={busy === 'create'}
          onClick={() => void createPreset()}
        >
          {busy === 'create' ? 'Enregistrement…' : 'Enregistrer le preset'}
        </button>
      </section>

      <section style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        {presets.presets.length === 0 && (
          <article className="card" style={{ padding: 22 }}>
            Aucun preset enregistré. Compose ton premier thème ci-dessus.
          </article>
        )}
        {presets.presets.map((preset) => (
          <article className="card" style={{ padding: 22 }} key={preset.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <small style={{ color: 'var(--mint)' }}>
                  {preset.isActive ? 'ACTIF' : preset.isDefault ? 'PAR DÉFAUT' : 'PRESET'}
                </small>
                <h2>{preset.name}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  {preset.items.length} objet{preset.items.length > 1 ? 's' : ''} validé{preset.items.length > 1 ? 's' : ''} côté serveur
                </p>
                <p>
                  {preset.items.map((entry) => `${SLOT_LABELS[entry.slot] ?? entry.slot} : ${entry.item.name}`).join(' · ')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn"
                  disabled={busy === `preview:${preset.id}`}
                  onClick={() => void previewPreset(preset.id)}
                >
                  Prévisualiser
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy === `activate:${preset.id}`}
                  onClick={() => void activatePreset(preset.id)}
                >
                  {preset.isActive ? 'Réactiver' : 'Activer'}
                </button>
                {!preset.isDefault && (
                  <button
                    className="btn"
                    disabled={busy === `default:${preset.id}`}
                    onClick={() => void makeDefault(preset.id)}
                  >
                    Par défaut
                  </button>
                )}
                <button
                  className="btn"
                  disabled={busy === `delete:${preset.id}`}
                  onClick={() => void removePreset(preset.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {preview && (
        <section className="card" style={{ padding: 22, marginTop: 24 }}>
          <small style={{ color: 'var(--mint)' }}>PRÉVISUALISATION SERVEUR</small>
          <h2>{preview.preset.name}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {preview.preview.map((entry) => (
              <div key={entry.slot} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                <strong>{SLOT_LABELS[entry.slot] ?? entry.slot}</strong> · {entry.item.name}
                {!entry.applicable && (
                  <p style={{ color: 'var(--muted)' }}>
                    Ce slot est masqué par tes réglages de confidentialité et ne sera pas activé.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <h2>Garanties</h2>
        <p style={{ color: 'var(--muted)' }}>
          Activation atomique : <strong>{presets.rules.atomicActivation ? 'oui' : 'non'}</strong> ·
          Idempotence : <strong>{presets.rules.idempotentActivation ? 'oui' : 'non'}</strong> ·
          Slots masqués respectés : <strong>{presets.rules.hiddenSlotsRespected ? 'oui' : 'non'}</strong> ·
          Nettoyage automatique : <strong>{presets.rules.unavailableItemsPruned ? 'oui' : 'non'}</strong>
        </p>
      </section>
    </main>
  );
}
