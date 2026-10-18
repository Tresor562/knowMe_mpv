import assert from 'node:assert/strict';
import test from 'node:test';
import { wrappedDialogFocus } from './dialog-focus.ts';

test('Tab wraps from the last button to the first and Shift+Tab reverses', () => {
  assert.equal(wrappedDialogFocus(3, 2, false), 0);
  assert.equal(wrappedDialogFocus(3, 0, true), 2);
  assert.equal(wrappedDialogFocus(3, 1, false), null);
  assert.equal(wrappedDialogFocus(3, 1, true), null);
});

test('keyboard trap recovers focus from outside and handles a single control', () => {
  assert.equal(wrappedDialogFocus(3, -1, false), 0);
  assert.equal(wrappedDialogFocus(3, -1, true), 2);
  assert.equal(wrappedDialogFocus(1, 0, false), 0);
  assert.equal(wrappedDialogFocus(1, 0, true), 0);
  assert.equal(wrappedDialogFocus(0, -1, false), null);
});
