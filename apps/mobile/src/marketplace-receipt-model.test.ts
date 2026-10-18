import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueGiftReceipts, marketplaceReceiptRows } from './marketplace-receipt-model.ts';
import type { CosmeticPurchaseReceipt } from './cosmetics.ts';
import type { MobileSocialGiftSentItem } from './social-gifts.ts';

const cosmetics = [{
  id: 'one', item: { name: 'Étoile bleue' }, priceKnowCoins: 120,
  purchasedAt: '2026-10-11T11:00:00Z'
}] as CosmeticPurchaseReceipt[];
const gifts = [{
  id: 'two', gift: { name: 'Rose' }, recipient: { displayName: 'Amie' },
  priceKnowCoins: 25, sentAt: '2026-10-16T11:00:00Z'
}] as MobileSocialGiftSentItem[];

test('merges server receipts in date order without treating them as full wallet history', () => {
  const rows = marketplaceReceiptRows(cosmetics, gifts);
  assert.deepEqual(rows.map(x => x.id), ['gift:two', 'cosmetic:one']);
  assert.deepEqual(rows.map(x => x.priceKnowCoins), [25, 120]);
});

test('filters sources and handles accents without mutating receipts', () => {
  const before = JSON.stringify([cosmetics, gifts]);
  assert.deepEqual(marketplaceReceiptRows(cosmetics, gifts, 'cosmetics', 'ETOILE').map(x => x.id), ['cosmetic:one']);
  assert.deepEqual(marketplaceReceiptRows(cosmetics, gifts, 'gifts', 'AMIE').map(x => x.id), ['gift:two']);
  assert.deepEqual(marketplaceReceiptRows(cosmetics, gifts, 'gifts', 'étoile'), []);
  assert.equal(JSON.stringify([cosmetics, gifts]), before);
});

test('paginated gift pages deduplicate both existing and repeated new receipts', () => {
  const current = [{ id: 'a' }];
  const combined = appendUniqueGiftReceipts(current, [{ id: 'a' }, { id: 'b' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(combined.map(x => x.id), ['a', 'b', 'c']);
  assert.deepEqual(current, [{ id: 'a' }]);
});

test('a malformed timestamp sorts after real timestamps without crashing', () => {
  const rows = marketplaceReceiptRows(
    [{ ...cosmetics[0]!, purchasedAt: 'invalid' }],
    gifts
  );
  assert.deepEqual(rows.map(x => x.id), ['gift:two', 'cosmetic:one']);
});

test('English receipt labels use the requested language without changing server amounts', () => {
  const rows = marketplaceReceiptRows(cosmetics, gifts, 'all', '', 'en');
  assert.equal(rows[0]?.detail, 'Gift for Amie');
  assert.equal(rows[1]?.detail, 'Cosmetic purchase');
  assert.deepEqual(rows.map(x => x.priceKnowCoins), [25, 120]);
});
