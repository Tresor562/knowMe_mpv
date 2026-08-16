import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKnowMeDeepLink,
  buildKnowMeUniversalPath,
  parseKnowMeDeepLink,
  parseKnowMeUniversalPath
} from '../dist/index.js';

test('builds and parses a versioned profile deep link', () => {
  const target = { kind: 'profile', id: 'usr_123456' };
  const link = buildKnowMeDeepLink(target);

  assert.equal(link, 'knowme://v1/profile/usr_123456');
  assert.deepEqual(parseKnowMeDeepLink(link), {
    version: 'v1',
    ...target
  });
});

test('builds and parses a universal path without changing target meaning', () => {
  const target = { kind: 'challenge', id: 'chl_abcdef12' };
  const path = buildKnowMeUniversalPath(target);

  assert.equal(path, '/open/v1/challenge/chl_abcdef12');
  assert.deepEqual(parseKnowMeUniversalPath(path), {
    version: 'v1',
    ...target
  });
});

test('rejects unsupported kinds and unsafe identifiers', () => {
  assert.equal(parseKnowMeDeepLink('knowme://v1/admin/usr_123456'), null);
  assert.equal(parseKnowMeDeepLink('knowme://v1/profile/../../admin'), null);
  assert.equal(parseKnowMeUniversalPath('/open/v1/profile/%2e%2e%2fadmin'), null);
  assert.throws(
    () => buildKnowMeDeepLink({ kind: 'profile', id: '../bad' }),
    /KNOWME_LINK_IDENTIFIER_INVALID/
  );
});

test('rejects query, fragment and credential smuggling in custom-scheme links', () => {
  assert.equal(parseKnowMeDeepLink('knowme://v1/profile/usr_123456?next=/admin'), null);
  assert.equal(parseKnowMeDeepLink('knowme://v1/profile/usr_123456#token'), null);
  assert.equal(parseKnowMeDeepLink('knowme://user:pass@v1/profile/usr_123456'), null);
});
