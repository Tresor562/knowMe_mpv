import type { MobileAvatarLayerSlot } from './avatar-studio';

export type AvatarStudioLocale = 'fr' | 'en';

const SLOTS: Record<MobileAvatarLayerSlot, readonly [string, string]> = {
  AVATAR_SKIN: ['Base et peau', 'Skin and base'],
  AVATAR_HAIR: ['Cheveux', 'Hair'],
  AVATAR_FACE: ['Visage', 'Face'],
  AVATAR_OUTFIT: ['Tenue', 'Outfit'],
  AVATAR_ACCESSORY: ['Accessoire', 'Accessory'],
  AVATAR_AURA: ['Aura', 'Aura']
};

const RARITIES: Record<string, readonly [string, string]> = {
  COMMON: ['Commun', 'Common'],
  UNCOMMON: ['Peu commun', 'Uncommon'],
  RARE: ['Rare', 'Rare'],
  EPIC: ['Épique', 'Epic'],
  LEGENDARY: ['Légendaire', 'Legendary']
};

export function avatarStudioSlotLabel(slot: MobileAvatarLayerSlot, locale: AvatarStudioLocale): string {
  return SLOTS[slot][locale === 'en' ? 1 : 0];
}

export function avatarStudioRarityLabel(value: string, locale: AvatarStudioLocale): string {
  return RARITIES[value]?.[locale === 'en' ? 1 : 0] ?? value.replaceAll('_', ' ').toLowerCase();
}

export function avatarStudioSlotStatus(
  slot: MobileAvatarLayerSlot, action: 'equipped' | 'removed', locale: AvatarStudioLocale
): string {
  const title = avatarStudioSlotLabel(slot, locale);
  if (locale === 'en') return `${title} ${action === 'equipped' ? 'updated' : 'removed'}.`;
  return `${title} : ${action === 'equipped' ? 'mise à jour effectuée' : 'élément retiré'}.`;
}

export function avatarStudioOptionCount(count: number, locale: AvatarStudioLocale): string {
  return locale === 'en' ? `${count} option${count === 1 ? '' : 's'}` :
    `${count} option${count === 1 ? '' : 's'}`;
}

export function avatarStudioLabel(locale: AvatarStudioLocale) {
  const en = locale === 'en';
  return {
    preview: en ? 'Avatar preview' : 'Aperçu de l’avatar',
    equipped: en ? 'Equipped' : 'Équipé',
    remove: en ? 'Remove' : 'Retirer',
    inventoryEmpty: en ? 'No compatible items in your inventory.' :
      'Aucun objet compatible dans ton inventaire.',
    updateFailed: en ? 'Could not update this avatar item.' : 'Impossible de modifier cet élément.',
    itemEquipped: en ? 'equipped' : 'équipé',
    policy: en
      ? 'Only items you own can be equipped. Your avatar visibility follows your privacy settings.'
      : 'Seuls les éléments de ton inventaire peuvent être équipés. La visibilité de ton avatar suit tes réglages de confidentialité.'
  };
}
