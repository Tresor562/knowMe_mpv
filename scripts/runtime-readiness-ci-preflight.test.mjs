import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/runtime-readiness.yml', import.meta.url), 'utf8');
const healthController = await readFile(new URL('../apps/api/src/health.controller.ts', import.meta.url), 'utf8');
const callMaintenance = await readFile(new URL('../apps/api/src/calls/call-maintenance.service.ts', import.meta.url), 'utf8');

test('readiness workflow exercises the exact production API image against isolated PostgreSQL', () => {
  assert.match(workflow, /docker build -f Dockerfile\.api -t knowme-api-readiness-ci \./);
  assert.match(workflow, /postgres:16\.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/knowme:knowme@127\.0\.0\.1:55432\/knowme_readiness\?schema=public/);
  assert.match(workflow, /pnpm db:migrate:deploy/);
  assert.match(workflow, /-e KNOWME_RELEASE_COMMIT="\$GITHUB_SHA"/);
  assert.doesNotMatch(workflow, /NODE_ENV=(development|test)/);
});

test('readiness proof has separate initial, dependency-loss and recovery gates', () => {
  assert.match(workflow, /name: Start exact API image and require initial readiness/);
  assert.match(workflow, /name: Prove PostgreSQL loss keeps liveness and sheds readiness/);
  assert.match(workflow, /name: Prove readiness recovers after PostgreSQL returns without API restart/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:4000\/health\/live/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:4000\/health\/ready/);
  assert.match(workflow, /docker stop "\$DB_RUNTIME_CONTAINER"/);
  assert.match(workflow, /\[ "\$live_code" = 200 \] && \[ "\$ready_code" = 503 \]/);
  assert.match(workflow, /docker start "\$DB_RUNTIME_CONTAINER"/);
  assert.match(workflow, /api_id_before="\$\(docker inspect --format='\{\{\.Id\}\}' "\$API_RUNTIME_CONTAINER"\)"/);
  assert.match(workflow, /API readiness did not recover within 120 seconds after the PostgreSQL host endpoint returned/);
});

test('recovery proof separates Docker host-port recovery from API recovery and preserves process identity', () => {
  assert.match(workflow, /docker run --rm --network host[\s\S]*pg_isready -h 127\.0\.0\.1 -p 55432 -U knowme -d knowme_readiness/);
  assert.match(workflow, /PostgreSQL restarted but its published host endpoint did not recover/);
  assert.match(workflow, /seq 1 60/);
  assert.match(workflow, /api_state="\$\(docker inspect --format='\{\{\.State\.Status\}\}' "\$API_RUNTIME_CONTAINER"\)"/);
  assert.match(workflow, /db_state="\$\(docker inspect --format='\{\{\.State\.Status\}\}' "\$DB_RUNTIME_CONTAINER"\)"/);
  assert.match(workflow, /test "\$\(docker inspect --format='\{\{\.Id\}\}' "\$API_RUNTIME_CONTAINER"\)" = "\$api_id_before"/);
});

test('readiness proof is bounded, always cleans resources and never serializes response bodies', () => {
  assert.match(workflow, /name: Clean KMD-364 runtime proof resources/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /docker rm -f "\$API_RUNTIME_CONTAINER"/);
  assert.match(workflow, /docker rm -f "\$DB_RUNTIME_CONTAINER"/);
  assert.match(workflow, /seq 1 30/);
  assert.match(workflow, /seq 1 20/);
  assert.match(workflow, /seq 1 60/);
  assert.match(workflow, /--output \/dev\/null --write-out '%\{http_code\}'/);
  assert.doesNotMatch(workflow, /curl[^\n]*(?:--include|-i\b)/);
});

test('API readiness remains fail-closed and secret-safe at the controller boundary', () => {
  assert.match(healthController, /@Get\('ready'\)/);
  assert.match(healthController, /await this\.prisma\.\$queryRaw`SELECT 1`/);
  assert.match(healthController, /throw new ServiceUnavailableException\(/);
  assert.doesNotMatch(healthController, /catch \((?:error|err|failure)\)[\s\S]{0,300}(?:message|stack|DATABASE_URL)/);
});

test('call maintenance contains transient scheduled failures instead of terminating the API process', () => {
  assert.match(callMaintenance, /setInterval\(\(\) => \{\s*void this\.runScheduledTick\(\);/);
  assert.match(callMaintenance, /private async runScheduledTick\(\)[\s\S]*try \{[\s\S]*await this\.tick\(\);[\s\S]*catch \(error\)/);
  assert.doesNotMatch(callMaintenance, /setInterval\(\(\) => void this\.tick\(\)/);
  assert.doesNotMatch(callMaintenance, /error\.message/);
});
