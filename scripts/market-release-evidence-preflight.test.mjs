import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  computeMarketReleaseEvidenceHmac,
  requiredEvidenceForScope,
  validateMarketReleaseEvidence,
} from './market-release-evidence-preflight.mjs';

const commit = 'a'.repeat(40);
const releaseVersion = '1.0.0-rc.1';
const signingKey = 'release-evidence-signing-key-0000001';
const signingKeyId = 'release-evidence-2026-08';
const now = new Date('2026-08-26T02:00:00.000Z');
const cliPath = fileURLToPath(new URL('./market-release-evidence-preflight.mjs', import.meta.url));

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-26T01:30:00.000Z',
    validUntil: '2026-08-27T01:30:00.000Z',
    verifier: 'release-reviewer',
    evidenceRef: `evidence://${id}`,
    evidenceSha256: 'b'.repeat(64),
  };
}

function manifest(scope = 'WEB_V1') {
  const value = {
    schemaVersion: 4,
    scope,
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion,
    signingKeyId,
    evidence: requiredEvidenceForScope(scope).map(item),
  };
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  return value;
}

function currentCliManifest() {
  const value = manifest();
  const current = Date.now();
  for (const evidence of value.evidence) {
    evidence.verifiedAt = new Date(current - 60_000).toISOString();
    evidence.validUntil = new Date(current + 3_600_000).toISOString();
  }
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  return value;
}

function runCli(file) {
  return spawnSync(
    process.execPath,
    [cliPath, '--file', file, '--commit', commit, '--version', releaseVersion],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID: signingKeyId,
        KNOWME_RELEASE_EVIDENCE_SIGNING_KEY: signingKey,
      },
    },
  );
}

function validate(value, options = {}) {
  return validateMarketReleaseEvidence(value, {
    expectedCommit: commit,
    expectedReleaseVersion: releaseVersion,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...options,
  });
}

test('accepts a complete authenticated WEB_V1 evidence manifest', () => {
  const result = validate(manifest());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('requires physical and store evidence for FULL scope', () => {
  const full = manifest('FULL');
  assert.ok(full.evidence.some((entry) => entry.id === 'ios_physical_validation'));
  assert.ok(full.evidence.some((entry) => entry.id === 'android_store_submission'));
  assert.equal(validate(full).ok, true);
});

test('does not require mobile/store evidence for a WEB_V1 release', () => {
  const web = manifest('WEB_V1');
  assert.equal(web.evidence.some((entry) => entry.id === 'ios_store_submission'), false);
  assert.equal(validate(web).ok, true);
});

test('fails when required evidence is missing or pending', () => {
  const value = manifest();
  value.evidence = value.evidence.filter((entry) => entry.id !== 'backup_restore_drill');
  value.evidence.find((entry) => entry.id === 'production_tls_domain').status = 'PENDING';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('backup_restore_drill')));
  assert.ok(result.errors.some((error) => error.includes('production_tls_domain.status')));
});

test('binds evidence to the exact release commit', () => {
  const result = validate(manifest(), { expectedCommit: 'b'.repeat(40) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('releaseCommit does not match the commit being released.'));
});

test('fails closed when the expected release commit is missing', () => {
  const result = validateMarketReleaseEvidence(manifest(), {
    expectedReleaseVersion: releaseVersion,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('expected release commit must be an explicit lowercase 40-character Git commit SHA.'));
});

test('binds evidence to an explicit production release version', () => {
  const wrongEnvironment = manifest();
  wrongEnvironment.environment = 'STAGING';
  const environmentResult = validate(wrongEnvironment);
  assert.equal(environmentResult.ok, false);
  assert.ok(environmentResult.errors.includes('environment must equal PRODUCTION.'));

  const wrongVersion = manifest();
  wrongVersion.releaseVersion = '1.0.1';
  const versionResult = validate(wrongVersion);
  assert.equal(versionResult.ok, false);
  assert.ok(versionResult.errors.includes('releaseVersion does not match the version being released.'));
});

test('fails closed when the expected release version is missing or non-canonical', () => {
  for (const expectedReleaseVersion of [undefined, '01.0.0', '1.0', '1.0.0+build.1', ' 1.0.0 ']) {
    const result = validateMarketReleaseEvidence(manifest(), {
      expectedCommit: commit,
      expectedReleaseVersion,
      expectedSigningKeyId: signingKeyId,
      signingKey,
      now,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('expected release version must be an explicit canonical SemVer version.'));
  }
});

test('rejects non-canonical manifest release versions', () => {
  for (const value of ['01.0.0', '1.0', '1.0.0+build.1', ' 1.0.0 ', 'v1.0.0']) {
    const candidate = manifest();
    candidate.releaseVersion = value;
    const result = validate(candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('releaseVersion')));
  }
});

test('binds the manifest to the expected signing key identity', () => {
  const wrongExpectedId = validate(manifest(), { expectedSigningKeyId: 'release-evidence-2026-09' });
  assert.equal(wrongExpectedId.ok, false);
  assert.ok(wrongExpectedId.errors.includes('signingKeyId does not match the release evidence signing key identity.'));

  const tampered = manifest();
  tampered.signingKeyId = 'release-evidence-2026-09';
  const tamperedResult = validate(tampered, { expectedSigningKeyId: 'release-evidence-2026-09' });
  assert.equal(tamperedResult.ok, false);
  assert.ok(tamperedResult.errors.some((error) => error.includes('manifestHmacSha256')));
});

test('fails closed when signing key identity is missing or non-canonical', () => {
  for (const expectedSigningKeyId of [undefined, '', 'Release-Key', ' release-key', 'release key', 'a'.repeat(65)]) {
    const result = validateMarketReleaseEvidence(manifest(), {
      expectedCommit: commit,
      expectedReleaseVersion: releaseVersion,
      expectedSigningKeyId,
      signingKey,
      now,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('expected signing key id')));
  }

  const missing = manifest();
  delete missing.signingKeyId;
  const missingResult = validate(missing);
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.errors.some((error) => error.includes('signingKeyId')));
});

test('rejects duplicate evidence ids', () => {
  const value = manifest();
  value.evidence.push(item('production_tls_domain'));
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Duplicate evidence id')));
});

test('rejects weak evidence metadata and future timestamps', () => {
  const value = manifest();
  const target = value.evidence[0];
  target.verifier = ' ';
  target.evidenceRef = 'short';
  target.verifiedAt = '2026-08-26T03:00:00.000Z';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.verifier')));
  assert.ok(result.errors.some((error) => error.includes('.evidenceRef')));
  assert.ok(result.errors.some((error) => error.includes('must not be in the future')));
});

test('requires and enforces a current validity deadline', () => {
  const missing = manifest();
  delete missing.evidence[0].validUntil;
  assert.equal(validate(missing).ok, false);

  const expired = manifest();
  expired.evidence[0].validUntil = '2026-08-26T01:59:59.999Z';
  const expiredResult = validate(expired);
  assert.ok(expiredResult.errors.some((error) => error.includes('has expired')));
});

test('requires a canonical SHA-256 digest for every retained evidence artifact', () => {
  for (const digest of [undefined, 'ABC', 'A'.repeat(64), 'a'.repeat(63), ` ${'a'.repeat(64)} `]) {
    const value = manifest();
    if (digest === undefined) delete value.evidence[0].evidenceSha256;
    else value.evidence[0].evidenceSha256 = digest;
    const result = validate(value);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('evidenceSha256')));
  }
});

test('rejects old schema, unknown scope and non-canonical commit ids', () => {
  const value = manifest();
  value.schemaVersion = 3;
  value.scope = 'MOBILE_ONLY';
  value.releaseCommit = 'ABC';
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('schemaVersion')));
  assert.ok(result.errors.some((error) => error.includes('scope must be')));
  assert.ok(result.errors.some((error) => error.includes('releaseCommit')));
});

test('fails closed when the release evidence signing key is missing, weak, or non-canonical', () => {
  for (const candidate of [undefined, 'short', ` ${signingKey}`, `${signingKey} `]) {
    const result = validateMarketReleaseEvidence(manifest(), {
      expectedCommit: commit,
      expectedReleaseVersion: releaseVersion,
      expectedSigningKeyId: signingKeyId,
      signingKey: candidate,
      now,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('release evidence signing key')));
  }
});

test('rejects a missing or malformed manifest HMAC', () => {
  const missing = manifest();
  delete missing.manifestHmacSha256;
  assert.equal(validate(missing).ok, false);

  const uppercase = manifest();
  uppercase.manifestHmacSha256 = uppercase.manifestHmacSha256.toUpperCase();
  assert.equal(validate(uppercase).ok, false);
});

test('detects tampering with signed release evidence metadata', () => {
  for (const mutate of [
    (value) => {
      value.evidence[0].status = 'PENDING';
    },
    (value) => {
      value.evidence[0].verifier = 'different-reviewer';
    },
    (value) => {
      value.evidence[0].validUntil = '2026-08-28T01:30:00.000Z';
    },
    (value) => {
      value.releaseVersion = '1.0.1';
    },
    (value) => {
      value.signingKeyId = 'release-evidence-2026-09';
    },
  ]) {
    const value = manifest();
    mutate(value);
    const result = validate(value);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('manifestHmacSha256')));
  }
});

test('accepts a manifest only after it is re-signed with the dedicated key', () => {
  const value = manifest();
  value.evidence[0].evidenceRef = 'evidence://production_tls_domain/revalidated';
  assert.equal(validate(value).ok, false);
  value.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(value, signingKey);
  assert.equal(validate(value).ok, true);
});

test('market release evidence preflight CLI accepts a regular bounded retained manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-market-preflight-'));
  const file = join(dir, 'manifest.json');
  try {
    await writeFile(file, `${JSON.stringify(currentCliManifest())}\n`);
    const result = runCli(file);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Market release evidence preflight passed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('market release evidence preflight CLI rejects a symlinked retained manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-market-preflight-symlink-'));
  const target = join(dir, 'target.json');
  const link = join(dir, 'manifest.json');
  try {
    await writeFile(target, `${JSON.stringify(currentCliManifest())}\n`);
    await symlink(target, link);
    const result = runCli(link);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.doesNotMatch(result.stdout, /preflight passed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
