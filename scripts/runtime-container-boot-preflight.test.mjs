import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const apiDockerfile = await readFile(new URL('../Dockerfile.api', import.meta.url), 'utf8');
const apiMain = await readFile(new URL('../apps/api/src/main.ts', import.meta.url), 'utf8');

test('canonical CI boots both runtime images instead of inspecting metadata only', () => {
  assert.match(workflow, /Boot API runtime container and require healthy status/);
  assert.match(workflow, /docker run -d --name "\$name" --network host/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:4000\/health\/live/);
  assert.match(workflow, /Boot Web runtime container and require healthy status/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:3000\/health\/live/);
});

test('runtime boot proof is bounded and fails closed', () => {
  const boundedLoops = workflow.match(/for attempt in \$\(seq 1 30\); do/g) ?? [];
  assert.equal(boundedLoops.length, 2);
  const unhealthyGuards = workflow.match(/\[ "\$status" = unhealthy \]/g) ?? [];
  assert.equal(unhealthyGuards.length, 2);
  const exitedGuards = workflow.match(/\.State\.Status/g) ?? [];
  assert.ok(exitedGuards.length >= 2);
  assert.match(workflow, /did not become healthy within 60 seconds/);
});

test('API boot proof supplies explicit CI-safe production runtime configuration', () => {
  assert.match(workflow, /-e DATABASE_URL="\$DATABASE_URL"/);
  assert.match(workflow, /-e JWT_SECRET="\$JWT_SECRET"/);
  assert.match(workflow, /-e PORT=4000/);
  assert.match(workflow, /-e KNOWME_RELEASE_COMMIT="\$GITHUB_SHA"/);
  assert.match(workflow, /-e KNOWME_RELEASE_VERSION=0\.0\.0-ci/);
  assert.match(workflow, /-e API_INSTANCE_COUNT=1/);
  assert.match(workflow, /-e API_RATE_LIMIT_TTL_MS=60000/);
  assert.match(workflow, /-e API_RATE_LIMIT_LIMIT=120/);
  assert.match(workflow, /-e TRUSTED_PROXY_HOPS=0/);
  assert.match(workflow, /-e API_REQUEST_TIMEOUT_MS=30000/);
  assert.match(workflow, /-e API_HEADERS_TIMEOUT_MS=15000/);
  assert.match(workflow, /-e API_KEEP_ALIVE_TIMEOUT_MS=5000/);
  assert.match(workflow, /CORS_ALLOWED_ORIGINS_JSON=\["https:\/\/ci\.invalid"\]/);
  assert.match(workflow, /-e MEDIA_STORAGE_DRIVER=s3/);
  assert.match(workflow, /-e MEDIA_S3_ENDPOINT=https:\/\/s3\.ci\.invalid/);
  assert.match(workflow, /-e MEDIA_S3_BUCKET=knowme-ci-runtime/);
  assert.match(workflow, /-e MEDIA_S3_REGION=ci-test-1/);
  assert.match(workflow, /-e MEDIA_S3_ACCESS_KEY_ID=ci-runtime-access-key/);
  assert.match(workflow, /-e MEDIA_S3_SECRET_ACCESS_KEY=ci-runtime-secret-key-not-for-production/);
  assert.doesNotMatch(workflow, /NODE_ENV=(development|test)/);
});

test('API image builds workspace runtime dependencies before boot', () => {
  assert.match(apiDockerfile, /RUN pnpm --filter @knowme\/api\.\.\. build/);
  assert.doesNotMatch(apiDockerfile, /RUN pnpm --filter @knowme\/api build/);
});

test('API bootstrap diagnostics are bounded, allowlisted and secret-safe', () => {
  assert.match(apiMain, /type BootstrapPhase =/);
  assert.match(apiMain, /'application-module-load'/);
  assert.doesNotMatch(apiMain, /import \{ AppModule \} from '\.\/app\.module'/);
  assert.match(apiMain, /await import\('\.\/app\.module'\)/);
  assert.match(apiMain, /NestFactory\.create\(AppModule, \{ rawBody: true, abortOnError: false \}\)/);
  assert.match(apiMain, /type StartupFailureCategory = 'module-resolution' \| 'configuration' \| 'runtime'/);
  assert.match(apiMain, /const STARTUP_CONFIGURATION_KEYS = \[/);
  assert.match(apiMain, /record\.code === 'MODULE_NOT_FOUND'/);
  assert.match(apiMain, /record\.code === 'ERR_MODULE_NOT_FOUND'/);
  assert.match(apiMain, /STARTUP_CONFIGURATION_KEYS\.find/);
  assert.match(apiMain, /bootstrap\(\)\.catch\(\(failure: unknown\) => \{/);
  assert.match(apiMain, /classifyStartupFailure\(failure\)/);
  assert.match(apiMain, /API bootstrap failed during \$\{bootstrapPhase\}\$\{suffix\}/);
  assert.doesNotMatch(apiMain, /console\.error\([^\n]*(?:failure\.message|failure\.stack|record\.message)/);
  assert.doesNotMatch(apiMain, /JSON\.stringify\(failure\)/);
  assert.match(apiMain, /process\.exitCode = 1/);
});
