import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/runtime-readiness.yml', import.meta.url), 'utf8');
const healthController = await readFile(new URL('../apps/api/src/health.controller.ts', import.meta.url), 'utf8');

test('readiness workflow exercises the exact production API image against isolated PostgreSQL', () => {
  assert.match(workflow, /docker build -f Dockerfile\.api -t knowme-api-readiness-ci \./);
  assert.match(workflow, /postgres:16\.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/knowme:knowme@127\.0\.0\.1:55432\/knowme_readiness\?schema=public/);
  assert.match(workflow, /pnpm db:migrate:deploy/);
  assert.match(workflow, /-e KNOWME_RELEASE_COMMIT="\$GITHUB_SHA"/);
  assert.doesNotMatch(workflow, /NODE_ENV=(development|test)/);
});

test('readiness proof distinguishes process liveness from PostgreSQL traffic readiness', () => {
  assert.match(workflow, /http:\/\/127\.0\.0\.1:4000\/health\/live/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:4000\/health\/ready/);
  assert.match(workflow, /docker stop "\$db"/);
  assert.match(workflow, /\[ "\$live_code" = 200 \] && \[ "\$ready_code" = 503 \]/);
  assert.match(workflow, /docker start "\$db"/);
  assert.match(workflow, /API readiness did not recover after PostgreSQL returned/);
});

test('readiness proof is bounded, cleans resources and never serializes response bodies', () => {
  assert.match(workflow, /trap cleanup EXIT/);
  assert.match(workflow, /docker rm -f "\$api"/);
  assert.match(workflow, /docker rm -f "\$db"/);
  assert.match(workflow, /seq 1 30/);
  assert.match(workflow, /seq 1 20/);
  assert.match(workflow, /--output \/dev\/null --write-out '%\{http_code\}'/);
  assert.doesNotMatch(workflow, /curl[^\n]*(?:--include|-i\b)/);
});

test('API readiness remains fail-closed and secret-safe at the controller boundary', () => {
  assert.match(healthController, /@Get\('ready'\)/);
  assert.match(healthController, /await this\.prisma\.\$queryRaw`SELECT 1`/);
  assert.match(healthController, /throw new ServiceUnavailableException\(/);
  assert.doesNotMatch(healthController, /catch \((?:error|err|failure)\)[\s\S]{0,300}(?:message|stack|DATABASE_URL)/);
});
