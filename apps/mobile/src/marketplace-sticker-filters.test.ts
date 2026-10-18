import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOfficialStickerPacks, filterPersonalStickerPacks } from './marketplace-sticker-filters.ts';

test('official sticker search includes descriptions and handles accents', () => {
  const packs = [
    { name: 'Émotions', description: 'Amis et célébrations' },
    { name: 'Nexus', description: 'Code et sécurité' }
  ];
  assert.deepEqual(filterOfficialStickerPacks(packs, 'celebrations').map(x => x.name), ['Émotions']);
  assert.deepEqual(filterOfficialStickerPacks(packs, 'seCURITE').map(x => x.name), ['Nexus']);
});

test('personal pack search includes names only and does not mutate local pack data', () => {
  const packs = [{ name: 'Chat noir', description: 'Nexus' }, { name: 'Voyage', description: 'Animaux' }];
  const before = JSON.stringify(packs);
  assert.deepEqual(filterPersonalStickerPacks(packs, 'CHAT').map(x => x.name), ['Chat noir']);
  assert.deepEqual(filterPersonalStickerPacks(packs, 'Nexus'), []);
  assert.equal(JSON.stringify(packs), before);
});
