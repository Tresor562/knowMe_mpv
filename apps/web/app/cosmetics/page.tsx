'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type CosmeticItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  slot: string;
  rarity: string;
  assetUrl: string;
  previewUrl: string | null;
};

type CosmeticOwnership = {
  id: string;
  itemId: string;
  source: string;
  acquiredAt: string;
  equipped: boolean;
  item: CosmeticItem;
};

type CosmeticEquipment = {
  id: string;
  slot: string;
  itemId: string;
  item: CosmeticItem;
};

type Rules = {
  visualOnly: boolean;
  gameplayEffectsAllowed: boolean;
  purchasesEnabled: boolean;
  paidPriorityAllowed: boolean;
  ownershipRequired: boolean;
  supportedSlots: string[];
};

type CatalogResponse = { items: CosmeticItem[]; rules: Rules };
type InventoryResponse = {
  inventory: CosmeticOwnership[];
  equipment: CosmeticEquipment[];
  rules: Rules;
};

const SLOT_LABELS: Record<string, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_BACKGROUND: 'Fond de profil',
  CHAT_BUBBLE: 'Bulle de discussion',
  PROFILE_BADGE: 'Accent de badge'
};

export default function CosmeticsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [message, setMessage] = useState('');
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [catalogResponse, inventoryResponse] = await Promise.all([
        apiFetch<CatalogResponse>('/cosmetics/catalog'),
        apiFetch<InventoryResponse>('/cosmetics/me')
      ]);
      setCatalog(catalogResponse);
      setInventory(inventoryResponse);
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Inventaire cosmétique indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const ownedBySlot = useMemo(() => {
    const grouped = new Map<string, CosmeticOwnership[]>();
    for (const ownership of inventory?.inventory ?? []) {
      const entries = grouped.get(ownership.item.slot) ?? [];
      entries.push(ownership);
      grouped.set(ownership.item.slot, entries);
    }
    return grouped;
  }, [inventory]);

  async function equip(slot: string, itemId: string | null) {
    setBusySlot(slot);
    try {
      await apiFetch(`/cosmetics/equipment/${slot}`, {
        method: 'PUT',
        body: JSON.stringify({ itemId })
      });
      setMessage(itemId ? 'Objet équipé. Le changement reste purement visuel.' : 'Emplacement libéré.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Équipement impossible.');
    } finally {
      setBusySlot(null);
    }
  }

  if (sessionLoading || !user || !catalog || !inventory) {
    return <main className="shell"><p>{message || 'Chargement de l’inventaire cosmétique…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--mint)' }}>COSMÉTIQUES KNOWME</small>
        <h1>Personnalise ton apparence, jamais ta puissance</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 760 }}>
          Les objets de ce catalogue sont exclusivement visuels. Ils ne modifient ni les scores,
          ni l’XP, ni les récompenses, ni la visibilité sociale. Les acquisitions KnowCoins utilisent
          le même inventaire autoritaire que les objets gratuits.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {catalog.rules.purchasesEnabled && (
            <a className="btn btn-primary" href="/cosmetics/shop">
              Ouvrir la boutique KnowCoins
            </a>
          )}
          <a className="btn" href="/cosmetics/presets">
            Composer des thèmes synchronisés
          </a>
        </div>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <h2>Garanties du catalogue</h2>
        <p>
          Visuel uniquement : <strong>{catalog.rules.visualOnly ? 'oui' : 'non'}</strong> · Effets de jeu :{' '}
          <strong>{catalog.rules.gameplayEffectsAllowed ? 'autorisés' : 'interdits'}</strong> · Achats :{' '}
          <strong>{catalog.rules.purchasesEnabled ? 'actifs' : 'désactivés'}</strong> · Priorité payante :{' '}
          <strong>{catalog.rules.paidPriorityAllowed ? 'autorisée' : 'interdite'}</strong>
        </p>
      </section>

      <section style={{ display: 'grid', gap: 18, marginTop: 24 }}>
        {inventory.rules.supportedSlots.map((slot) => {
          const owned = ownedBySlot.get(slot) ?? [];
          const equipped = inventory.equipment.find((entry) => entry.slot === slot);
          return (
            <article className="card" style={{ padding: 20 }} key={slot}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <small style={{ color: 'var(--mint)' }}>{slot}</small>
                  <h2>{SLOT_LABELS[slot] ?? slot}</h2>
                  <p style={{ color: 'var(--muted)' }}>
                    Équipé : <strong>{equipped?.item.name ?? 'aucun objet'}</strong>
                  </p>
                </div>
                {equipped && (
                  <button
                    className="btn"
                    disabled={busySlot === slot}
                    onClick={() => void equip(slot, null)}
                  >
                    Retirer
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {owned.length === 0 && <p>Aucun objet possédé pour cet emplacement.</p>}
                {owned.map((ownership) => (
                  <div
                    key={ownership.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <strong>{ownership.item.name}</strong>
                      <p style={{ color: 'var(--muted)', margin: '6px 0' }}>
                        {ownership.item.description ?? 'Objet cosmétique KnowMe.'}
                      </p>
                      <small>
                        {ownership.item.rarity} · Version {ownership.item.version} · Source {ownership.source}
                      </small>
                    </div>
                    <button
                      className={ownership.equipped ? 'btn' : 'btn btn-primary'}
                      disabled={ownership.equipped || busySlot === slot}
                      onClick={() => void equip(slot, ownership.itemId)}
                    >
                      {ownership.equipped ? 'Équipé' : 'Équiper'}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="card" style={{ padding: 20, marginTop: 24 }}>
        <h2>Catalogue actuellement publié</h2>
        <p style={{ color: 'var(--muted)' }}>
          {catalog.items.length} version{catalog.items.length > 1 ? 's' : ''} active{catalog.items.length > 1 ? 's' : ''}.
          La publication ne donne pas automatiquement la possession.
        </p>
      </section>
    </main>
  );
}
