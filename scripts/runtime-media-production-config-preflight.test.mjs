import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const mediaUploadPolicy = await readFile(
  new URL('../apps/api/src/media/media-upload-policy.ts', import.meta.url),
  'utf8'
);

const canonicalCiMaxBytes = '26214400';

test('production media upload policy remains fail-closed without an explicit limit', () => {
  const productionGuard = mediaUploadPolicy.match(
    /if \(env\.NODE_ENV === 'production'\) \{\n(?<body>[\s\S]*?)\n\s{4}\}/
  );

  assert.ok(productionGuard?.groups?.body, 'production MEDIA_UPLOAD_MAX_BYTES guard must remain explicit');
  assert.match(
    productionGuard.groups.body,
    /throw new Error\('MEDIA_UPLOAD_MAX_BYTES is required in production\.'\)/
  );
  assert.doesNotMatch(productionGuard.groups.body, /return DEFAULT_MEDIA_UPLOAD_MAX_BYTES/);

  assert.match(
    mediaUploadPolicy,
    /if \(!raw\) \{[\s\S]*if \(env\.NODE_ENV === 'production'\) \{[\s\S]*throw new Error\('MEDIA_UPLOAD_MAX_BYTES is required in production\.'\)[\s\S]*\}\n\s{4}return DEFAULT_MEDIA_UPLOAD_MAX_BYTES;/
  );
});

test('application-graph probe and real API boot both supply the bounded production upload limit', () => {
  const occurrences = workflow.match(/-e MEDIA_UPLOAD_MAX_BYTES=26214400/g) ?? [];
  assert.equal(occurrences.length, 2);
  assert.match(workflow, /name: Probe API application graph module loading[\s\S]*-e MEDIA_UPLOAD_MAX_BYTES=26214400[\s\S]*knowme-api-ci \/app\/apps\/api\/scripts\/runtime-app-module-load-probe\.cjs/);
  assert.match(workflow, /name: Boot API runtime container and require healthy status[\s\S]*-e MEDIA_UPLOAD_MAX_BYTES=26214400[\s\S]*knowme-api-ci/);
  assert.equal(Number(canonicalCiMaxBytes), 25 * 1024 * 1024);
});
