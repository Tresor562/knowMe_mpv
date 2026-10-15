import test from 'node:test';
import assert from 'node:assert/strict';
import { readCheckedOutKnowMeVersion } from './knowme-release-manifest.mjs';

test('deployment picks the checked-out source version, not stale VPS environment', () => {
  const data = JSON.stringify({product:'KnowMe',productVersion:'1.1.1',contractRevision:'2026-10-11.4'});
  assert.equal(readCheckedOutKnowMeVersion(data),'1.1.1');
});
test('invalid or incomplete release metadata cannot silently overwrite production', () => {
  assert.throws(()=>readCheckedOutKnowMeVersion('{invalid'));
  assert.throws(()=>readCheckedOutKnowMeVersion(JSON.stringify({productVersion:'1.1.0'})));
  assert.throws(()=>readCheckedOutKnowMeVersion(JSON.stringify({product:'KnowMe',productVersion:'latest',contractRevision:'2026-10-11.4'})));
});
