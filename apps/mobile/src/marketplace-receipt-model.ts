import type { CosmeticPurchaseReceipt } from './cosmetics';
import type { MobileSocialGiftSentItem } from './social-gifts';

export type ReceiptFilter = 'all' | 'cosmetics' | 'gifts';
export type MarketplaceReceiptRow = {
  id: string;
  kind: 'cosmetics' | 'gifts';
  label: string;
  detail: string;
  priceKnowCoins: number;
  createdAt: string;
};

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function marketplaceReceiptRows(
  cosmetics: readonly CosmeticPurchaseReceipt[],
  gifts: readonly MobileSocialGiftSentItem[],
  filter: ReceiptFilter = 'all',
  query = '',
  locale: 'fr' | 'en' = 'fr'
): MarketplaceReceiptRow[] {
  const search = normalized(query);
  const all: MarketplaceReceiptRow[] = [
    ...cosmetics.map(item => ({
      id: 'cosmetic:' + item.id,
      kind: 'cosmetics' as const,
      label: item.item.name,
      detail: locale === 'en' ? 'Cosmetic purchase' : 'Achat de personnalisation',
      priceKnowCoins: item.priceKnowCoins,
      createdAt: item.purchasedAt
    })),
    ...gifts.map(item => ({
      id: 'gift:' + item.id,
      kind: 'gifts' as const,
      label: item.gift.name,
      detail: (locale === 'en' ? 'Gift for ' : 'Cadeau à ') +
        (item.recipient?.displayName ?? (locale === 'en' ? 'a recipient' : 'un destinataire')),
      priceKnowCoins: item.priceKnowCoins,
      createdAt: item.sentAt
    }))
  ];
  return all
    .filter(item => (filter === 'all' || item.kind === filter) &&
      (!search || normalized(item.label + ' ' + item.detail).includes(search)))
    .sort((a, b) => {
      const first = Date.parse(a.createdAt), second = Date.parse(b.createdAt);
      return (Number.isFinite(second) ? second : 0) - (Number.isFinite(first) ? first : 0);
    });
}

export function appendUniqueGiftReceipts<T extends { id: string }>(previous: readonly T[], page: readonly T[]): T[] {
  const seen = new Set(previous.map(item => item.id));
  return [...previous, ...page.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  })];
}
