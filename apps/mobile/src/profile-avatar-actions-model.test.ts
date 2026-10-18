import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarActionText, canRemoveAvatar } from './profile-avatar-actions-model.ts';

test('avatar menu has localized labels and no placeholder symbols', () => {
  const fr = avatarActionText('fr');
  const en = avatarActionText('en');
  assert.equal(fr.remove, 'Retirer la photo');
  assert.equal(en.remove, 'Remove picture');
  assert.match(fr.confirmDescription, /publications/);
  assert.match(en.confirmDescription, /stories/);
  for (const t of [fr,en]) {
    assert.ok(t.addStory.length > 3 && t.view.length > 3 && t.close.length > 3);
    assert.doesNotMatch(t.addStory, /◉|▧|◎/);
  }
});

test('removal is available only for an existing picture with no pending write', () => {
  assert.equal(canRemoveAvatar(null, false), false);
  assert.equal(canRemoveAvatar(undefined, false), false);
  assert.equal(canRemoveAvatar('  ', false), false);
  assert.equal(canRemoveAvatar('https://example.test/avatar.jpg', true), false);
  assert.equal(canRemoveAvatar('https://example.test/avatar.jpg', false), true);
});
