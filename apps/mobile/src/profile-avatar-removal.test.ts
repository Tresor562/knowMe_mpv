import assert from 'node:assert/strict';
import test from 'node:test';
import { removeActiveProfileAvatar } from './profile-avatar-removal.ts';

test('sends explicit null and refreshes only after a successful PATCH', async () => {
  const calls: string[] = [];
  const result = await removeActiveProfileAvatar(async payload => {
    assert.deepEqual(payload, { avatarUrl: null });
    calls.push('patch');
  }, async () => { calls.push('refresh'); });
  assert.deepEqual(calls, ['patch', 'refresh']);
  assert.deepEqual(result, { profileSynced: true });
});

test('a failed server PATCH never updates the visible profile', async () => {
  let refreshes = 0;
  await assert.rejects(
    removeActiveProfileAvatar(async () => {
      throw new Error('HTTP 503');
    }, async () => { refreshes += 1; }),
    /503/
  );
  assert.equal(refreshes, 0);
});

test('refresh failure after a confirmed PATCH reports pending sync and never retries removal', async () => {
  let writes = 0;
  const result = await removeActiveProfileAvatar(async () => { writes += 1; },
    async () => { throw new Error('Refresh failed'); });
  assert.deepEqual(result, { profileSynced: false });
  assert.equal(writes, 1);
});
