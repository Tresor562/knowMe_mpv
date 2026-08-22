import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_GAME_LIBRARY,
  filterGameCenterCatalog,
  gameCenterCategories,
  gameFavoriteKeys,
  type GameCenterCard
} from './game-center-model.ts';

const catalog: GameCenterCard[] = [
  {
    key: 'pulse-duel',
    version: 1,
    name: 'Pulse Duel',
    description: 'Duel de réaction rapide',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['instant', 'social'],
    modes: ['multiplayer'],
    estimatedMinutes: 2,
    guestEligible: false,
    authoritativeServer: true,
    replayAvailable: true,
    economicStakeAllowed: false
  },
  {
    key: 'affinity-mirror',
    version: 1,
    name: 'Affinity Mirror',
    description: 'Questions relationnelles',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['social'],
    modes: ['multiplayer'],
    estimatedMinutes: 5,
    guestEligible: false,
    authoritativeServer: true,
    replayAvailable: true,
    economicStakeAllowed: false
  }
];

test('Game Center categories are unique and stable', () => {
  assert.deepEqual(gameCenterCategories(catalog), ['instant', 'social']);
});

test('Game Center catalog filters by category and semantic text fields', () => {
  assert.deepEqual(filterGameCenterCatalog(catalog, '', 'instant').map((game) => game.key), ['pulse-duel']);
  assert.deepEqual(filterGameCenterCatalog(catalog, 'relationnelles', '').map((game) => game.key), ['affinity-mirror']);
  assert.deepEqual(filterGameCenterCatalog(catalog, 'SOCIAL', '').map((game) => game.key), ['pulse-duel', 'affinity-mirror']);
});

test('favorite projection exposes only favorite definition keys', () => {
  const keys = gameFavoriteKeys({
    ...EMPTY_GAME_LIBRARY,
    favorites: [{ ...catalog[0]!, favoritedAt: '2026-08-22T00:00:00.000Z' }]
  });
  assert.deepEqual([...keys], ['pulse-duel']);
  assert.equal(keys.has('affinity-mirror'), false);
});
