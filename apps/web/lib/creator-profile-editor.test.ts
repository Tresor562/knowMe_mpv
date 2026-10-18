import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorFormIssue, creatorFormPayload, type CreatorForm } from './creator-profile-editor.ts';

const form: CreatorForm = {
  slug: 'creations_abc', title: ' A creator ', bio: ' hello ',
  category: 'ART', status: 'PAUSED', visibility: 'UNLISTED'
};

test('saving another field never publishes an unlisted creator profile', () => {
  assert.deepEqual(creatorFormPayload(form, 5), {
    slug: 'creations_abc', title: 'A creator', bio: 'hello',
    category: 'ART', visibility: 'UNLISTED', status: 'PAUSED',
    expectedVersion: 5
  });
});
test('public creators retain their public visibility and version', () => {
  const payload = creatorFormPayload({ ...form, visibility: 'PUBLIC', status: 'ACTIVE' }, 6);
  assert.equal(payload.visibility, 'PUBLIC');
  assert.equal(payload.status, 'ACTIVE');
  assert.equal(payload.expectedVersion, 6);
});
test('web inputs reject bad slugs and invalid display names before PUT', () => {
  assert.equal(creatorFormIssue({ ...form, slug: '_private' }), 'slug');
  assert.equal(creatorFormIssue({ ...form, slug: 'ab' }), 'slug');
  assert.equal(creatorFormIssue({ ...form, title: '  ' }), 'title');
  assert.equal(creatorFormIssue({ ...form, category: 'INVALID' }), 'category');
  assert.throws(() => creatorFormPayload({ ...form, title: '' }, 0), /INVALID_TITLE/);
});
test('version must be valid and must be the server version', () => {
  assert.throws(() => creatorFormPayload(form, -1), /INVALID_VERSION/);
  assert.throws(() => creatorFormPayload(form, NaN), /INVALID_VERSION/);
});
