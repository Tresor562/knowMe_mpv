import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCreatorSlug, creatorDraftError, creatorUpdatePayload, type CreatorDraft
} from './creator-profile-editor-model.ts';

const draft: CreatorDraft = {
  slug: 'studio-creator_12',
  title: '  Mon studio  ',
  bio: '  Mes créations  ',
  category: 'ART',
  visibility: 'UNLISTED',
  status: 'PAUSED'
};

test('an unlisted creator never becomes public when editing another field', () => {
  const payload = creatorUpdatePayload(draft, 7);
  assert.deepEqual(payload, {
    slug: 'studio-creator_12',
    title: 'Mon studio',
    bio: 'Mes créations',
    category: 'ART',
    visibility: 'UNLISTED',
    status: 'PAUSED',
    expectedVersion: 7
  });
});

test('input normalization always respects the slug contract enforced by the API', () => {
  assert.equal(normalizeCreatorSlug('___ABC Café /123'), 'abccaf123');
  assert.equal(normalizeCreatorSlug('é__'), '');
  assert.equal(normalizeCreatorSlug('A'.repeat(100)).length, 40);
  assert.equal(creatorDraftError({ ...draft, slug: 'ab' }), 'slug');
  assert.equal(creatorDraftError({ ...draft, slug: '_good' }), 'slug');
});

test('invalid titles and server versions are rejected before making a network request', () => {
  assert.equal(creatorDraftError({ ...draft, title: ' ' }), 'title');
  assert.equal(creatorDraftError({ ...draft, category: 'INVALID' }), 'category');
  assert.throws(() => creatorUpdatePayload(draft, -1), /INVALID_VERSION/);
});

test('editing a public active creator preserves public visibility and active status', () => {
  const payload = creatorUpdatePayload({
    ...draft, visibility: 'PUBLIC', status: 'ACTIVE', title: 'Updated'
  }, 0);
  assert.equal(payload.visibility, 'PUBLIC');
  assert.equal(payload.status, 'ACTIVE');
  assert.equal(payload.expectedVersion, 0);
});
