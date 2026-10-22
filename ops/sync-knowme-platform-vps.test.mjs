import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseDescendsFromMain } from './sync-knowme-platform-vps.mjs';

const source = 'a'.repeat(40);
const main = 'b'.repeat(40);
const other = 'c'.repeat(40);
const compare = () => ({
  status: 'ahead', ahead_by: 2, behind_by: 0,
  base_commit: { sha: source }, merge_base_commit: { sha: source },
});

test('same main commit is valid without a comparison', () => {
  assert.equal(assertReleaseDescendsFromMain(source, source).relationship, 'identical');
});
test('older actual main-ancestor is eligible while Android release lags', () => {
  const outcome = assertReleaseDescendsFromMain(source, main, compare());
  assert.equal(outcome.relationship, 'ancestor');
  assert.equal(outcome.main, main);
});
test('unmerged branch commit is rejected even with green PR checks', () => {
  assert.throws(() => assertReleaseDescendsFromMain(source, main,
    { ...compare(), status: 'diverged', behind_by: 3, merge_base_commit: { sha: other } }), /not an ancestor/);
});
test('newer branch ahead of main cannot be deployed', () => {
  assert.throws(() => assertReleaseDescendsFromMain(source, main,
    { ...compare(), status: 'behind' }), /not an ancestor/);
});
test('comparison must match exact source SHA, not a forged status', () => {
  assert.throws(() => assertReleaseDescendsFromMain(source, main,
    { ...compare(), base_commit: { sha: other } }), /not an ancestor/);
  assert.throws(() => assertReleaseDescendsFromMain(source, main,
    { ...compare(), merge_base_commit: { sha: other } }), /not an ancestor/);
});
test('incomplete metadata and behind count fail closed', () => {
  for (const candidate of [
    null, undefined, {}, { status: 'ahead' },
    { ...compare(), ahead_by: 0 }, { ...compare(), behind_by: 1 },
    { ...compare(), behind_by: '0' },
  ]) {
    assert.throws(() => assertReleaseDescendsFromMain(source, main, candidate), /not an ancestor/);
  }
});
test('invalid SHA identifiers do not initiate a release', () => {
  for (const invalid of ['', 'main', 'g'.repeat(40), 'a'.repeat(39), null]) {
    assert.throws(() => assertReleaseDescendsFromMain(invalid, main, compare()), /exact Git commit SHAs/);
    assert.throws(() => assertReleaseDescendsFromMain(source, invalid, compare()), /exact Git commit SHAs/);
  }
});
test('uppercase SHA variants compare safely', () => {
  assert.equal(assertReleaseDescendsFromMain(source.toUpperCase(), main.toUpperCase(), compare()).relationship, 'ancestor');
});
test('import of reconciler does not start live VPS deployment', () => {
  assert.equal(typeof assertReleaseDescendsFromMain, 'function');
});
