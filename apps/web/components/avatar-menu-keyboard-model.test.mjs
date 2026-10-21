import assert from 'node:assert/strict';
import test from 'node:test';
import { nextAvatarMenuIndex } from './avatar-menu-keyboard-model.ts';

test('avatar menu arrow keys wrap, skip outside origin and handle one item', () => {
  assert.equal(nextAvatarMenuIndex('ArrowDown', -1, 5), 0);
  assert.equal(nextAvatarMenuIndex('ArrowUp', -1, 5), 4);
  assert.equal(nextAvatarMenuIndex('ArrowDown', 4, 5), 0);
  assert.equal(nextAvatarMenuIndex('ArrowUp', 0, 5), 4);
  assert.equal(nextAvatarMenuIndex('ArrowDown', 0, 5), 1);
  assert.equal(nextAvatarMenuIndex('ArrowUp', 4, 5), 3);
  assert.equal(nextAvatarMenuIndex('ArrowUp', 0, 1), 0);
});
test('Home and End respect enabled-item count and empty menus', () => {
  assert.equal(nextAvatarMenuIndex('Home', 2, 5), 0);
  assert.equal(nextAvatarMenuIndex('End', 2, 5), 4);
  assert.equal(nextAvatarMenuIndex('Home', 0, 0), -1);
  assert.equal(nextAvatarMenuIndex('End', 0, -5), -1);
  assert.equal(nextAvatarMenuIndex('ArrowDown', 99, 5), 0);
  assert.equal(nextAvatarMenuIndex('ArrowUp', 99, 5), 4);
});
