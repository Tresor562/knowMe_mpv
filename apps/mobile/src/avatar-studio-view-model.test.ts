import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarStudioPhase } from './avatar-studio-view-model.ts';

test('first avatar-studio load shows progress before a response', () => {
  assert.equal(avatarStudioPhase(true, false), 'loading');
});
test('a failed avatar-studio load transitions to retryable error, not infinite spinner', () => {
  assert.equal(avatarStudioPhase(false, false), 'error');
});
test('refreshing existing avatar-studio data preserves the content', () => {
  assert.equal(avatarStudioPhase(true, true), 'ready');
  assert.equal(avatarStudioPhase(false, true), 'ready');
});
