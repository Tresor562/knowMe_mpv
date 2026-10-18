import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMarketplaceOffers } from './marketplace-offer-filters.ts';

const offers = [
  { id: 'a', itemId: 'item1', owned: false, item: { name: 'Cadre Étoilé', description: 'Cadre bleu', slot: 'AVATAR_FRAME', rarity: 'COMMON' } },
  { id: 'b', itemId: 'item2', owned: true, item: { name: 'Fond pastel', description: null, slot: 'PROFILE_BACKGROUND', rarity: 'RARE' } },
  { id: 'c', itemId: 'item3', owned: false, item: { name: 'Bulles rondes', description: 'Chat violet', slot: 'CHAT_BUBBLE', rarity: 'EPIC' } }
];

test('finds names and descriptions without requiring accents or exact case', () => {
  const matches = filterMarketplaceOffers(offers, 'etoile', 'all', new Set(), new Set());
  assert.deepEqual(matches.map(item => item.id), ['a']);
  assert.deepEqual(filterMarketplaceOffers(offers, 'VIOLET', 'all', new Set(), new Set()).map(item => item.id), ['c']);
});

test('combines query and filter and respects API-confirmed ownership', () => {
  const owned = new Set(['item3']);
  assert.deepEqual(filterMarketplaceOffers(offers, '', 'owned', owned, new Set()).map(x => x.id), ['b', 'c']);
  assert.deepEqual(filterMarketplaceOffers(offers, 'chat', 'owned', owned, new Set()).map(x => x.id), ['c']);
  assert.deepEqual(filterMarketplaceOffers(offers, '', 'available', owned, new Set()).map(x => x.id), ['a']);
});

test('equipped filter is based on real server equipment, never on purchase guesses', () => {
  const equipped = new Set(['item2']);
  assert.deepEqual(filterMarketplaceOffers(offers, '', 'equipped', new Set(), equipped).map(x => x.id), ['b']);
  assert.deepEqual(filterMarketplaceOffers(offers, 'not-found', 'equipped', new Set(), equipped), []);
});

test('client-side filtering does not mutate offers or grant ownership', () => {
  const before = JSON.stringify(offers);
  filterMarketplaceOffers(offers, 'CADRE', 'all', new Set(), new Set());
  assert.equal(JSON.stringify(offers), before);
  assert.equal(offers[0]?.owned, false);
});
