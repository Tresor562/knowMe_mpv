import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { assessMarketReleaseEvidenceReadiness } from './market-release-evidence-readiness-report.mjs';

const NOW = new Date('2026-08-28T03:00:00.000Z');
const WEB_IDS = [
  'production_tls_domain',
  'production_deployment_smoke',
  'backup_restore_drill',
  'external_monitoring_alerting',
  'privacy_terms_legal_review',
  'data_export_delete_validation',
  'moderation_support_incident_ops',
  'antimalware_provider_validation',
];

function item(id, overrides = {}) {
  return {
    id,
    status: 'VERIFIED',
    validUntil: '2026-08-29T03:00:00.000Z',
    ...overrides,
  };
}

function cliManifest() {
  return {
    scope: 'WEB_V1',
    evidence: WEB_IDS.map((id) => item(id, { validUntil: '2099-01-01T00:00:00.000Z' })),
  };
}

test('reports a complete WEB_V1 manifest without claiming authenticity', () => {
  const report = assessMarketReleaseEvidenceReadiness(
    { scope: 'WEB_V1', evidence: WEB_IDS.map((id) => item(id)) },
    { now: NOW },
  );
  assert.equal(report.complete, true);
  assert.equal(report.requiredCount, 8);
  assert.equal(report.verifiedCount, 8);
  assert.equal(report.blockingCount, 0);
  assert.match(report.proofBoundary, /does not authenticate evidence/);
});

test('classifies missing, pending, expired and malformed expiry independently', () => {
  const evidence = WEB_IDS.slice(1).map((id) => item(id));
  evidence[0] = item(WEB_IDS[1], { status: 'PENDING' });
  evidence[1] = item(WEB_IDS[2], { validUntil: '2026-08-28T02:59:59.999Z' });
  evidence[2] = item(WEB_IDS[3], { validUntil: 'not-a-date' });

  const report = assessMarketReleaseEvidenceReadiness(
    { scope: 'WEB_V1', evidence },
    { now: NOW },
  );

  assert.equal(report.complete, false);
  assert.equal(report.blockingCount, 4);
  assert.deepEqual(
    Object.fromEntries(report.evidence.map((entry) => [entry.id, entry.state])),
    {
      production_tls_domain: 'MISSING',
      production_deployment_smoke: 'PENDING',
      backup_restore_drill: 'EXPIRED',
      external_monitoring_alerting: 'INVALID_EXPIRY',
      privacy_terms_legal_review: 'VERIFIED',
      data_export_delete_validation: 'VERIFIED',
      moderation_support_incident_ops: 'VERIFIED',
      antimalware_provider_validation: 'VERIFIED',
    },
  );
});

test('fails closed on duplicate required evidence ids', () => {
  const evidence = WEB_IDS.map((id) => item(id));
  evidence.push(item('production_tls_domain'));
  assert.throws(
    () => assessMarketReleaseEvidenceReadiness({ scope: 'WEB_V1', evidence }, { now: NOW }),
    /Duplicate release evidence id: production_tls_domain/,
  );
});

test('fails closed on malformed, noncanonical, unexpected and invalid-status entries', () => {
  assert.throws(
    () => assessMarketReleaseEvidenceReadiness({ scope: 'WEB_V1', evidence: [null] }, { now: NOW }),
    /evidence\[0\] must be an object/,
  );
  assert.throws(
    () =>
      assessMarketReleaseEvidenceReadiness(
        { scope: 'WEB_V1', evidence: [item(' production_tls_domain')] },
        { now: NOW },
      ),
    /id must be a canonical non-empty string/,
  );
  assert.throws(
    () =>
      assessMarketReleaseEvidenceReadiness(
        { scope: 'WEB_V1', evidence: [item('ios_physical_validation')] },
        { now: NOW },
      ),
    /Unexpected release evidence id for readiness scope: ios_physical_validation/,
  );
  assert.throws(
    () =>
      assessMarketReleaseEvidenceReadiness(
        { scope: 'WEB_V1', evidence: [item('production_tls_domain', { status: 'DONE' })] },
        { now: NOW },
      ),
    /status must equal PENDING or VERIFIED/,
  );
});

test('FULL includes physical-device and store evidence', () => {
  const fullIds = [
    ...WEB_IDS,
    'ios_physical_validation',
    'android_physical_validation',
    'ios_store_submission',
    'android_store_submission',
  ];
  const report = assessMarketReleaseEvidenceReadiness(
    { scope: 'FULL', evidence: fullIds.map((id) => item(id)) },
    { now: NOW },
  );
  assert.equal(report.requiredCount, 12);
  assert.equal(report.complete, true);
});

test('rejects malformed top-level inputs instead of guessing', () => {
  assert.throws(() => assessMarketReleaseEvidenceReadiness(null), /JSON object/);
  assert.throws(() => assessMarketReleaseEvidenceReadiness({ scope: 'MOBILE', evidence: [] }), /scope/);
  assert.throws(() => assessMarketReleaseEvidenceReadiness({ scope: 'WEB_V1' }), /evidence must be an array/);
});

test('readiness CLI accepts a regular bounded manifest file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'knowme-readiness-'));
  try {
    const manifestPath = path.join(dir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(cliManifest()));
    const result = spawnSync(process.execPath, ['scripts/market-release-evidence-readiness-report.mjs', '--file', manifestPath], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.complete, true);
    assert.equal(report.verifiedCount, WEB_IDS.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readiness CLI rejects a symlinked manifest before JSON ingestion', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'knowme-readiness-'));
  try {
    const targetPath = path.join(dir, 'target.json');
    const manifestPath = path.join(dir, 'manifest.json');
    await writeFile(targetPath, JSON.stringify(cliManifest()));
    await symlink(targetPath, manifestPath);
    const result = spawnSync(process.execPath, ['scripts/market-release-evidence-readiness-report.mjs', '--file', manifestPath], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(result.stdout, '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
