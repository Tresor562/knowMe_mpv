export type MarketplaceCatalogFilter = 'all' | 'available' | 'owned' | 'equipped';

type FilterableOffer = {
  id: string;
  itemId: string;
  owned: boolean;
  item: {
    name: string;
    description: string | null;
    slot: string;
    rarity: string;
  };
};

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

/** Client-side discovery only; ownership and purchasing authority remain server-side. */
export function filterMarketplaceOffers<T extends FilterableOffer>(
  offers: readonly T[],
  query: string,
  filter: MarketplaceCatalogFilter,
  ownedIds: ReadonlySet<string>,
  equippedIds: ReadonlySet<string>
): T[] {
  const search = normalizeSearch(query);
  return offers.filter(offer => {
    const owned = offer.owned || ownedIds.has(offer.itemId);
    const equipped = equippedIds.has(offer.itemId);
    if (filter === 'available' && owned) return false;
    if (filter === 'owned' && !owned) return false;
    if (filter === 'equipped' && !equipped) return false;
    if (!search) return true;
    return normalizeSearch([
      offer.item.name,
      offer.item.description ?? '',
      offer.item.slot,
      offer.item.rarity
    ].join(' ')).includes(search);
  });
}
