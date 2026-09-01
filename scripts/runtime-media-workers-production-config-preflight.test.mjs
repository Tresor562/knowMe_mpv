import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const retentionWorker = await readFile(
  new URL('../apps/api/src/admin/media-quarantine-retention-worker.service.ts', import.meta.url),
  'utf8'
);
const retryWorker = await readFile(
  new URL('../apps/api/src/admin/media-quarantine-retry-worker.service.ts', import.meta.url),
  'utf8'
);
const alertService = await readFile(
  new URL('../apps/api/src/admin/media-purge-alert.service.ts', import.meta.url),
  'utf8'
);

const bootBlock = workflow.match(
  /- name: Boot API runtime container and require healthy status[\s\S]*?- name: Upload API runtime diagnostics/
)?.[0];
assert.ok(bootBlock, 'API runtime boot block must exist');

test('real API production boot receives explicit CI-only media worker policy', () => {
  for (const binding of [
    '-e MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS=30',
    '-e MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS=7',
    '-e MEDIA_QUARANTINE_RETRY_ENABLED=false',
    '-e MEDIA_QUARANTINE_RETRY_INTERVAL_MS=60000',
    '-e MEDIA_QUARANTINE_RETRY_BATCH_SIZE=10',
    '-e MEDIA_PURGE_ALERT_WEBHOOK_URL=https://alerts.ci.invalid/hook',
    '-e MEDIA_PURGE_ALERT_WEBHOOK_TOKEN=ci-only-media-purge-alert-token-0001',
    '-e MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS=2000'
  ]) {
    assert.match(bootBlock, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('production retention policy remains mandatory and bounded', () => {
  assert.match(retentionWorker, /if \(infectedDays === null \|\| unavailableDays === null\)/);
  assert.match(retentionWorker, /if \(this\.isProduction\(\)\) \{/);
  assert.match(retentionWorker, /Media quarantine retention policy must be fully configured in production/);
  assert.match(retentionWorker, /parsed < 1 \|\| parsed > 3650/);
});

test('production retry worker policy remains explicit even when retries are disabled', () => {
  assert.match(retryWorker, /if \(raw !== 'true' && raw !== 'false'\)/);
  assert.match(retryWorker, /MEDIA_QUARANTINE_RETRY_ENABLED must be explicitly set/);
  assert.match(retryWorker, /if \(this\.isProduction\(\)\) throw new Error\(`\$\{name\} is required in production\.`\)/);
});

test('production purge alert configuration remains mandatory and validated', () => {
  assert.match(alertService, /process\.env\.NODE_ENV === 'production' && !this\.readConfig\(\)/);
  assert.match(alertService, /url\.protocol !== 'https:'/);
  assert.match(alertService, /token\.length < MIN_TOKEN_LENGTH/);
  assert.match(alertService, /timeoutMs < MIN_TIMEOUT_MS/);
  assert.match(alertService, /timeoutMs > MAX_TIMEOUT_MS/);
});
