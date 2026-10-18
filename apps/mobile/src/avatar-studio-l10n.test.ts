import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avatarStudioLabel, avatarStudioSlotLabel, avatarStudioRarityLabel,
  avatarStudioSlotStatus, avatarStudioOptionCount
} from './avatar-studio-l10n.ts';

test('slot names have appropriate French and English titles', () => {
  assert.equal(avatarStudioSlotLabel('AVATAR_HAIR', 'en'), 'Hair');
  assert.equal(avatarStudioSlotLabel('AVATAR_HAIR', 'fr'), 'Cheveux');
  assert.equal(avatarStudioSlotLabel('AVATAR_OUTFIT', 'en'), 'Outfit');
});

test('rarity names and unfamiliar server values have safe display fallbacks', () => {
  assert.equal(avatarStudioRarityLabel('UNCOMMON', 'en'), 'Uncommon');
  assert.equal(avatarStudioRarityLabel('LEGENDARY', 'fr'), 'Légendaire');
  assert.equal(avatarStudioRarityLabel('SPECIAL_EVENT', 'en'), 'special event');
});

test('success messages use translated slot nouns and consistent English grammar', () => {
  assert.equal(avatarStudioSlotStatus('AVATAR_HAIR', 'equipped', 'en'), 'Hair updated.');
  assert.equal(avatarStudioSlotStatus('AVATAR_HAIR', 'removed', 'fr'), 'Cheveux : élément retiré.');
});

test('counts are properly pluralized and accessibility strings are localized', () => {
  assert.equal(avatarStudioOptionCount(1, 'en'), '1 option');
  assert.equal(avatarStudioOptionCount(3, 'fr'), '3 options');
  assert.match(avatarStudioLabel('en').policy, /privacy settings/);
  assert.match(avatarStudioLabel('fr').policy, /confidentialité/);
});
