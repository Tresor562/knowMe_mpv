import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinationMetadata, overlappingPaths, getOverlaps } from './coordination-core.mjs';

test('validates a workstream + existing issue reference format', () => {
  assert.deepEqual(
    coordinationMetadata({
      head: { ref: 'chat/reels/offline-cache' },
      body: 'Workstream: reels\nCoordination-Issue: #695\n',
    }),
    { coordinated: true, domain: 'reels', issueNumber: 695, branch: 'chat/reels/offline-cache' },
  );
});

test('rejects unregistered workstreams, spoofed metadata and missing tickets', () => {
  assert.throws(() => coordinationMetadata({
    head: { ref: 'chat/unknown/feature' },
    body: 'Workstream: unknown\nCoordination-Issue: #3',
  }), /invalide/);
  assert.throws(() => coordinationMetadata({
    head: { ref: 'chat/social/comments' },
    body: 'Workstream: infra\nCoordination-Issue: #694',
  }), /social/);
  assert.throws(() => coordinationMetadata({
    head: { ref: 'chat/social/comments' },
    body: 'Workstream: social',
  }), /Coordination-Issue/);
});

test('historical branches stay unmodified by metadata validation', () => {
  assert.deepEqual(coordinationMetadata({ head: { ref: 'feat/older-feature' } }), {
    coordinated: false, branch: 'feat/older-feature',
  });
});

test('file overlap is exact, sorted, deduplicated', () => {
  assert.deepEqual(
    overlappingPaths(['apps/api/src/a.ts', 'apps/web/a.ts'], ['apps/web/a.ts', 'apps/web/a.ts', 'README.md']),
    ['apps/web/a.ts'],
  );
});

test('only competing PRs with same base are considered', () => {
  assert.deepEqual(getOverlaps(
    { number: 4, base: { ref: 'main' } },
    ['apps/mobile/Video.tsx', 'apps/api/src/a.ts'],
    [
      { pr: { number: 8, base: { ref: 'main' } }, files: ['apps/mobile/Video.tsx'] },
      { pr: { number: 4, base: { ref: 'main' } }, files: ['apps/api/src/a.ts'] },
      { pr: { number: 9, base: { ref: 'stacked' } }, files: ['apps/api/src/a.ts'] },
      { pr: { number: 10, base: { ref: 'main' } }, files: ['docs/a.md'] },
    ],
  ), [{ number: 8, paths: ['apps/mobile/Video.tsx'] }]);
});
