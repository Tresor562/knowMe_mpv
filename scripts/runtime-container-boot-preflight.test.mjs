import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const apiDockerfile = await readFile(new URL('../Dockerfile.api', import.meta.url), 'utf8');
const apiPackage = await readFile(new URL('../apps/api/package.json', import.meta.url), 'utf8');
const apiLauncher = await readFile(new URL('../apps/api/src/launcher.ts', import.meta.url), 'utf8');
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

test('API boot failures persist bounded runtime diagnostics for later inspection', () => {
  assert.match(workflow, /id: api_runtime_boot/);
  assert.match(workflow, /diagnostics="\$RUNNER_TEMP\/knowme-api-runtime-diagnostics\.log"/);
  assert.match(workflow, /tee "\$diagnostics"/);
  assert.match(workflow, /name: Upload API runtime diagnostics/);
  assert.match(workflow, /if: \$\{\{ failure\(\) && steps\.api_runtime_boot\.outcome == 'failure' \}\}/);
  assert.doesNotMatch(workflow, /name: Upload API runtime diagnostics\n\s+if: \$\{\{ steps\.api_runtime_boot\.outcome == 'failure' \}\}/);
  assert.doesNotMatch(workflow, /name: Upload API runtime diagnostics\n\s+if: failure\(\)/);
  assert.match(workflow, /name: knowme-api-runtime-diagnostics/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /retention-days: 7/);
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

test('API runtime starts through a bounded pre-bootstrap launcher', () => {
  assert.match(apiPackage, /"start": "node dist\/launcher\.js"/);
  assert.match(apiLauncher, /process\.once\('uncaughtException'/);
  assert.match(apiLauncher, /process\.once\('unhandledRejection'/);
  assert.match(apiLauncher, /require\('\.\/main'\)/);
  assert.match(apiLauncher, /catch \{/);
  assert.match(apiLauncher, /writeSync\(2, `\[startup\] API entrypoint failed before bootstrap \(\$\{category\}\)\.\\n`\)/);
  assert.match(apiLauncher, /process\.exit\(1\)/);
  assert.doesNotMatch(apiLauncher, /catch \([^)]/);
  assert.doesNotMatch(apiLauncher, /JSON\.stringify/);
  assert.doesNotMatch(apiLauncher, /\.message|\.stack/);
});

test('API bootstrap owns runtime dependency loading before application graph evaluation', () => {
  assert.match(apiMain, /'runtime-module-load'/);
  assert.doesNotMatch(apiMain, /^import\s/m);
  assert.match(apiMain, /bootstrapPhase = 'runtime-module-load'/);
  assert.match(apiMain, /import\('@nestjs\/common'\)/);
  assert.match(apiMain, /import\('@nestjs\/core'\)/);
  assert.match(apiMain, /import\('\.\/common\/cors-policy'\)/);
  assert.match(apiMain, /import\('\.\/common\/release-identity'\)/);
  assert.match(apiMain, /import\('\.\/common\/transport-security'\)/);
  assert.match(apiMain, /import\('\.\/common\/trusted-proxy-policy'\)/);
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
