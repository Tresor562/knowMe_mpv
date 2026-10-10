'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AVATAR_LAYER_LABELS, AVATAR_LAYER_SLOTS, AvatarLayerSlot, AvatarManifest,
  AvatarStudioState, equipAvatarLayer, getAvatarStudio
} from '../../lib/avatar-studio';
import { useI18n } from '../../components/i18n-provider';
import { useSession } from '../../lib/use-session';

function AvatarPreview({ manifest }: { manifest: AvatarManifest }) {
  const layers = manifest.layers.filter(layer => layer.item);
  return <div className="km-studio-preview" aria-label="Avatar preview">
    {layers.length === 0 && (manifest.legacyAvatarUrl
      ? <img src={manifest.legacyAvatarUrl} alt="Avatar" className="km-studio-preview-image" />
      : <strong>{manifest.fallback.initials}</strong>)}
    {layers.map(layer => <img key={`${layer.slot}:${layer.item!.id}:${layer.item!.version}`}
      src={layer.item!.assetUrl} alt={layer.item!.name} className="km-studio-layer"
      style={{ zIndex: layer.zIndex }} />)}
  </div>;
}

export default function AvatarStudioPage() {
  const { user, loading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const [studio, setStudio] = useState<AvatarStudioState | null>(null);
  const [busySlot, setBusySlot] = useState<AvatarLayerSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvatarLayerSlot | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try { setStudio(await getAvatarStudio()); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : tr('Studio indisponible.','Studio unavailable.')); }
  }, [user?.id, locale]);

  useEffect(() => { void load(); }, [load]);

  const inventoryBySlot = useMemo(() => {
    const map = new Map<AvatarLayerSlot, AvatarStudioState['inventory']>();
    if (!studio) return map;
    for (const slot of AVATAR_LAYER_SLOTS) map.set(slot, studio.inventory.filter(row => row.item.slot === slot));
    return map;
  }, [studio]);

  async function equip(slot: AvatarLayerSlot, itemId: string | null) {
    if (busySlot) return;
    setBusySlot(slot);
    setMessage('');
    try {
      const result = await equipAvatarLayer(slot, itemId);
      setStudio(result.studio);
      setMessage(itemId ? tr('Apparence mise à jour.','Appearance updated.') : tr('Élément retiré.','Item removed.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Modification impossible.','Could not update avatar.'));
    } finally { setBusySlot(null); }
  }

  if (loading || !user || !studio) return <main className="shell km-studio-page">
    <Link href="/profile" className="km-native-back">‹ {tr('Profil','Profile')}</Link>
    <p role="status">{message || tr('Chargement du studio…','Loading avatar studio…')}</p>
  </main>;

  return <main className="shell km-studio-page">
    <header className="km-studio-header">
      <Link href="/profile" className="km-native-back" aria-label={tr('Retour au profil','Back to profile')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>
      </Link>
      <div><h1>{tr('Personnaliser mon avatar','Customize my avatar')}</h1>
        <span>@{studio.profile.username}</span></div>
      <Link href="/cosmetics" className="km-studio-inventory-link">{tr('Inventaire','Inventory')}</Link>
    </header>

    <section className="km-studio-identity" aria-label={tr('Aperçu de mon avatar','Avatar preview')}>
      <AvatarPreview manifest={studio.manifest} />
      <div><strong>{studio.profile.displayName}</strong>
        <p>{tr('Un aperçu fidèle de tes éléments équipés.','A preview of your equipped items.')}</p>
        <Link href={`/profile/${encodeURIComponent(studio.profile.username)}`}>{tr('Voir le profil public','View public profile')} →</Link>
      </div>
    </section>

    {message && <p className="km-studio-notice" role="status">{message}</p>}
    <h2 className="km-studio-section-heading">{tr('Apparence','Appearance')}</h2>
    <div className="km-studio-slots">
      {AVATAR_LAYER_SLOTS.map(slot => {
        const items = inventoryBySlot.get(slot) ?? [];
        const equipped = studio.equipment.find(row => row.slot === slot)?.item ?? null;
        const expanded = selectedSlot === slot;
        return <section className="km-studio-slot" key={slot}>
          <button type="button" className="km-studio-slot-trigger"
            aria-expanded={expanded} aria-controls={`km-layer-${slot}`}
            onClick={() => setSelectedSlot(expanded ? null : slot)}>
            <div><strong>{AVATAR_LAYER_LABELS[slot]}</strong>
              <small>{equipped?.name ?? tr('Aucun élément équipé','Nothing equipped')}</small></div>
            <span aria-hidden="true" className="km-studio-chevron">›</span>
          </button>
          {expanded && <div id={`km-layer-${slot}`} className="km-studio-slot-content">
            {equipped && <button type="button" className="km-studio-remove" disabled={busySlot !== null}
              onClick={() => void equip(slot, null)}>{busySlot === slot ? tr('Modification…','Updating…') : tr('Retirer cet élément','Remove equipped item')}</button>}
            {items.length === 0
              ? <p className="km-studio-empty">{tr('Aucun élément disponible pour cette catégorie. Consulte ton inventaire ou tes récompenses.','No items available for this category. Check your inventory or rewards.')}</p>
              : <div className="km-studio-item-grid">{items.map(entry => {
                const selected = equipped?.id === entry.item.id;
                return <button type="button" key={entry.id} disabled={busySlot !== null}
                  className={`km-studio-item${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected} onClick={() => void equip(slot, entry.item.id)}>
                  <img src={entry.item.previewUrl ?? entry.item.assetUrl} alt={entry.item.name} loading="lazy"/>
                  <strong>{entry.item.name}</strong>
                  <small>{selected ? tr('Équipé','Equipped') : entry.item.rarity}</small>
                </button>;
              })}</div>}
          </div>}
        </section>;
      })}
    </div>
    <Link className="km-studio-footer-link" href="/privacy/cosmetics">{tr('Confidentialité des éléments cosmétiques','Cosmetic privacy settings')} →</Link>
  </main>;
}
