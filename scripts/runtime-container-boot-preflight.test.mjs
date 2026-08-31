import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const apiDockerfile = await readFile(new URL('../Dockerfile.api', import.meta.url), 'utf8');
const apiPackage = await readFile(new URL('../apps/api/package.json', import.meta.url), 'utf8');
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

test('API runtime image uses and verifies the canonical compiled main entrypoint', () => {
  assert.match(apiDockerfile, /CMD \["node", "apps\/api\/dist\/main\.js"\]/);
  assert.doesNotMatch(apiDockerfile, /CMD \["pnpm"/);
  assert.match(apiPackage, /"start": "node dist\/main\.js"/);
  assert.match(workflow, /name: Verify API runtime entrypoint artifact/);
  assert.match(workflow, /\["node","apps\/api\/dist\/main\.js"\]/);
  assert.match(workflow, /set -eux/);
  assert.match(workflow, /test -r \/app\/apps\/api\/dist\/main\.js/);
  assert.match(workflow, /grep -F "main-enter" \/app\/apps\/api\/dist\/main\.js/);
  assert.match(workflow, /node --check \/app\/apps\/api\/dist\/main\.js/);
  assert.match(workflow, /mkdir -p \/app\/\.knowme-ci-write-proof/);
  assert.match(workflow, /test -w \/app\/\.knowme-ci-write-proof/);
  assert.match(workflow, /rmdir \/app\/\.knowme-ci-write-proof/);
  assert.doesNotMatch(apiDockerfile, /launcher\.js/);
  assert.doesNotMatch(apiPackage, /launcher\.js/);
});

test('API runtime image can load native production dependencies before application graph boot', () => {
  assert.match(workflow, /name: Verify API native runtime dependencies/);
  assert.match(workflow, /cd \/app\/apps\/api && node -e "require\(\\"argon2\\"\)/);
  assert.match(workflow, /argon2-ok/);
  assert.match(workflow, /const \{ PrismaClient \} = require\(\\"@prisma\/client\\"\)/);
  assert.match(workflow, /new PrismaClient\(\)/);
  assert.match(workflow, /prisma-client-ok/);
});

test('API boot failure diagnostics preserve only a bounded startup phase marker', () => {
  assert.match(workflow, /phase_marker="\$RUNNER_TEMP\/knowme-api-startup-phase"/);
  assert.match(workflow, /-e KNOWME_STARTUP_PHASE_DIAGNOSTIC=1/);
  assert.match(workflow, /API startup diagnostic flag/);
  assert.match(workflow, /grep -Fx 'KNOWME_STARTUP_PHASE_DIAGNOSTIC=1'/);
  assert.match(workflow, /docker cp "\$name":\/app\/\.knowme-startup-phase "\$phase_marker"/);
  assert.match(workflow, /--- API startup phase marker ---/);
  assert.match(apiMain, /type StartupTracePhase = 'main-enter' \| BootstrapPhase/);
  assert.match(apiMain, /process\.env\.KNOWME_STARTUP_PHASE_DIAGNOSTIC !== '1'/);
  assert.match(apiMain, /writeFileSync\('\/app\/\.knowme-startup-phase', phase/);
  assert.match(apiMain, /persistStartupPhase\('main-enter'\)/);
  assert.match(apiMain, /function setBootstrapPhase\(phase: BootstrapPhase\): void/);
  assert.doesNotMatch(apiMain, /writeFileSync\([^\n]*(?:process\.env\.(?!KNOWME_STARTUP_PHASE_DIAGNOSTIC)|JSON\.stringify)/);
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

test('API main owns all runtime dependency loading before application graph evaluation', () => {
  assert.match(apiMain, /'runtime-module-load'/);
  assert.doesNotMatch(apiMain, /^import\s/m);
  assert.match(apiMain, /setBootstrapPhase\('runtime-module-load'\)/);
  assert.match(apiMain, /import\('@nestjs\/common'\)/);
  assert.match(apiMain, /import\('@nestjs\/core'\)/);
  assert.match(apiMain, /import\('\.\/common\/cors-policy'\)/);
  assert.match(apiMain, /import\('\.\/common\/release-identity'\)/);
  assert.match(apiMain, /import\('\.\/common\/transport-security'\)/);
  assert.match(apiMain, /import\('\.\/common\/trusted-proxy-policy'\)/);
});

test('API bootstrap reports all terminal startup diagnostics synchronously with bounded text', () => {
  assert.match(apiMain, /function writeStartupDiagnostic\(message: string\): void \{/);
  assert.match(apiMain, /require\('node:fs'\)\.writeSync\(2, `\$\{message\}\\n`\)/);
  assert.doesNotMatch(apiMain, /process\.stderr\.write\(/);
  assert.doesNotMatch(apiMain, /console\.error\(/);
  assert.match(apiMain, /let bootstrapFailureReported = false/);
  assert.match(apiMain, /process\.once\('exit', \(code\) => \{/);
  assert.match(apiMain, /code !== 0 && !bootstrapFailureReported/);
  assert.match(apiMain, /writeStartupDiagnostic\(`\[startup\] API process exited during \$\{bootstrapPhase\} \(unowned-exit\)\.`\)/);
  assert.match(apiMain, /bootstrapFailureReported = true/);
  assert.doesNotMatch(apiMain, /process\.once\('exit', \((?:error|failure|reason)/);
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
  assert.match(apiMain, /writeStartupDiagnostic\(`\[startup\] API bootstrap failed during \$\{bootstrapPhase\}\$\{suffix\}\.`\)/);
  assert.doesNotMatch(apiMain, /writeStartupDiagnostic\([^\n]*(?:failure\.message|failure\.stack|record\.message)/);
  assert.doesNotMatch(apiMain, /JSON\.stringify\(failure\)/);
  assert.match(apiMain, /process\.exitCode = 1/);
});
