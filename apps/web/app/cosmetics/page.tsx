'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type CosmeticDefinition = {
  id: string;
  key: string;
  version: number;
  type: string;
  slot: string;
  name: string;
  description: string;
  assetUrl?: string | null;
  rarity: string;
};

type CosmeticGrant = {
  id: string;
  grantedAt: string;
  revokedAt?: string | null;
  definition: CosmeticDefinition;
};

type CosmeticEquipment = {
  id: string;
  slot: string;
  grantId: string;
  grant: CosmeticGrant;
};

type CosmeticInventory = {
  available: CosmeticGrant[];
  equipment: CosmeticEquipment[];
  history: CosmeticGrant[];
  rules: {
    serverAuthoritative: boolean;
    purelyVisual: boolean;
    purchasesEnabled: boolean;
    premiumPowerAllowed: boolean;
    clientGrantedOwnershipAllowed: boolean;
    oneEquippedItemPerSlot: boolean;
  };
};

const slotLabels: Record<string, string> = {
  AVATAR_FRAME: 'Cadre d’avatar',
  PROFILE_THEME: 'Thème de profil',
  CHAT_BUBBLE: 'Bulle de discussion',
  PROFILE_ACCENT: 'Accent de profil'
};

export default function CosmeticsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [inventory, setInventory] = useState<CosmeticInventory | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setInventory(await apiFetch<CosmeticInventory>('/cosmetics/me'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Inventaire indisponible.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  const equippedBySlot = useMemo(
    () => new Map((inventory?.equipment ?? []).map((item) => [item.slot, item])),
    [inventory]
  );

  async function equip(slot: string, grantId: string | null) {
    setSaving(true);
    try {
      const next = await apiFetch<CosmeticInventory>(`/cosmetics/equipment/${slot}`, {
        method: 'PATCH',
        body: JSON.stringify({ grantId })
      });
      setInventory(next);
      setMessage(grantId ? 'Objet équipé.' : 'Objet retiré.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Équipement impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user || !inventory) {
    return (
      <main className="shell">
        <p>{message || 'Chargement de ton inventaire cosmétique…'}</p>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: 'var(--mint)' }}>INVENTAIRE AUTORITAIRE</small>
          <h1>Cosmétiques de {user.displayName}</h1>
          <p style={{ color: 'var(--muted)' }}>
            Propriété et équipement sont vérifiés par le serveur. Aucun objet ne donne de pouvoir.
          </p>
        </div>
        <Link href="/achievements" className="btn btn-primary">
          Voir mes mérites
        </Link>
      </header>

      {message && <p role="status">{message}</p>}

      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <small style={{ color: 'var(--orange)' }}>RÈGLES DU CATALOGUE</small>
        <h2>Visuel uniquement, sans achat</h2>
        <p style={{ color: 'var(--muted)' }}>
          Les achats sont désactivés dans cette fondation. Premium, KnowCoins et le client ne peuvent
          ni créer une propriété, ni augmenter une capacité, ni contourner une révocation.
        </p>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Objets disponibles</h2>
        <div className="grid">
          {inventory.available.map((grant) => {
            const equipped = equippedBySlot.get(grant.definition.slot)?.grantId === grant.id;
            return (
              <article className="card" key={grant.id} style={{ padding: 20 }}>
                <small style={{ color: 'var(--mint)' }}>
                  {slotLabels[grant.definition.slot] ?? grant.definition.slot} ·{' '}
                  {grant.definition.rarity}
                </small>
                <h3>{grant.definition.name}</h3>
                <p>{grant.definition.description}</p>
                <small style={{ color: 'var(--muted)', display: 'block', marginBottom: 14 }}>
                  Version {grant.definition.version} · obtenu le{' '}
                  {new Date(grant.grantedAt).toLocaleDateString('fr-FR')}
                </small>
                <button
                  className={equipped ? 'btn' : 'btn btn-primary'}
                  disabled={saving}
                  onClick={() =>
                    void equip(grant.definition.slot, equipped ? null : grant.id)
                  }
                >
                  {equipped ? 'Retirer' : 'Équiper'}
                </button>
              </article>
            );
          })}
          {!inventory.available.length && (
            <article className="card" style={{ padding: 24 }}>
              <h3>Aucun cosmétique disponible</h3>
              <p style={{ color: 'var(--muted)' }}>
                Les objets apparaîtront ici après une attribution vérifiée côté serveur.
              </p>
            </article>
          )}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Équipement actuel</h2>
        <div className="grid">
          {Object.keys(slotLabels).map((slot) => {
            const equipment = equippedBySlot.get(slot);
            return (
              <article className="card" key={slot} style={{ padding: 18 }}>
                <small style={{ color: 'var(--muted)' }}>{slotLabels[slot]}</small>
                <h3>{equipment?.grant.definition.name ?? 'Aucun objet équipé'}</h3>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
