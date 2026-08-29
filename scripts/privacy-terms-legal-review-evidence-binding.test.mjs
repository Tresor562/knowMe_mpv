import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createPrivacyTermsLegalReviewEvidenceItem,
  validatePrivacyTermsLegalReviewArtifact,
} from './privacy-terms-legal-review-evidence-binding.mjs';

const NOW = new Date('2026-08-27T22:00:00.000Z');
const BOUNDARY =
  'This artifact proves only that the retained production privacy, terms, consent, data-lifecycle, minors/age-gate, and processor/subprocessor materials were reviewed and recorded; it does not itself establish legal compliance, regulatory approval, or continuing validity after product or law changes.';
const cliPath = fileURLToPath(new URL('./privacy-terms-legal-review-evidence-binding.mjs', import.meta.url));

function artifact() {
  return {
    schemaVersion: 1,
    kind: 'knowme-privacy-terms-legal-review',
    status: 'PASSED',
    observedAt: '2026-08-27T21:30:00.000Z',
    environment: 'PRODUCTION',
    checks: {
      privacyPolicyReview: 'PASSED',
      termsReview: 'PASSED',
      consentReview: 'PASSED',
      dataLifecycleReview: 'PASSED',
      minorsAgeGateReview: 'PASSED',
      processorSubprocessorReview: 'PASSED',
    },
    privacyPolicySha256: 'a'.repeat(64),
    termsSha256: 'b'.repeat(64),
    consentNoticeSha256: 'c'.repeat(64),
    legalReviewRecordSha256: 'd'.repeat(64),
    proofBoundary: BOUNDARY,
  };
}

function cliArgs(artifactPath, outputPath) {
  return [
    cliPath,
    '--artifact', artifactPath,
    '--output', outputPath,
    '--scope', 'WEB_V1',
    '--verifier', 'release-governance',
    '--ref', 'evidence://privacy-legal-review/cli',
    '--valid-until', '2026-09-27T21:30:00.000Z',
  ];
}

test('accepts exact PASSED production legal-review artifact', () => {
  assert.deepEqual(validatePrivacyTermsLegalReviewArtifact(artifact(), { now: NOW }), {
    ok: true,
    verifiedAt: artifact().observedAt,
  });
});

test('rejects unknown fields and incomplete legal checks', () => {
  assert.equal(
    validatePrivacyTermsLegalReviewArtifact({ ...artifact(), extra: true }, { now: NOW }).ok,
    false,
  );

  const failed = artifact();
  failed.checks.minorsAgeGateReview = 'FAILED';
  assert.match(
    validatePrivacyTermsLegalReviewArtifact(failed, { now: NOW }).errors.join(' '),
    /minorsAgeGateReview/,
  );
});

test('rejects malformed digests, future observations, and widened proof boundaries', () => {
  const badDigest = artifact();
  badDigest.privacyPolicySha256 = 'ABC';
  assert.match(
    validatePrivacyTermsLegalReviewArtifact(badDigest, { now: NOW }).errors.join(' '),
    /privacyPolicySha256/,
  );

  const future = artifact();
  future.observedAt = '2026-08-28T00:00:00.000Z';
  assert.match(
    validatePrivacyTermsLegalReviewArtifact(future, { now: NOW }).errors.join(' '),
    /future/,
  );

  const widened = artifact();
  widened.proofBoundary = 'This proves KnowMe is legally compliant everywhere.';
  assert.match(
    validatePrivacyTermsLegalReviewArtifact(widened, { now: NOW }).errors.join(' '),
    /proofBoundary/,
  );
});

test('creates only privacy_terms_legal_review evidence from exact retained bytes', () => {
  const bytes = Buffer.from(`${JSON.stringify(artifact())}\n`, 'utf8');
  const result = createPrivacyTermsLegalReviewEvidenceItem(bytes, {
    scope: 'WEB_V1',
    verifier: 'release-governance',
    evidenceRef: 'evidence://privacy-legal-review/2026-08-27',
    validUntil: '2026-09-27T21:30:00.000Z',
    now: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.item.id, 'privacy_terms_legal_review');
  assert.equal(result.item.status, 'VERIFIED');
  assert.equal(result.item.verifiedAt, artifact().observedAt);
  assert.match(result.item.evidenceSha256, /^[0-9a-f]{64}$/);
});

test('does not convert malformed JSON into VERIFIED evidence', () => {
  const result = createPrivacyTermsLegalReviewEvidenceItem(Buffer.from('{not-json'), {
    scope: 'WEB_V1',
    verifier: 'release-governance',
    evidenceRef: 'evidence://privacy-legal-review/invalid',
    validUntil: '2026-09-27T21:30:00.000Z',
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /valid JSON/);
});

test('CLI creates privacy legal-review evidence from a regular retained artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-privacy-legal-binding-'));
  try {
    const artifactPath = join(dir, 'privacy-legal-review.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(artifactPath, `${JSON.stringify(artifact(), null, 2)}\n`);

    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const item = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(item.id, 'privacy_terms_legal_review');
    assert.equal(item.status, 'VERIFIED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a symlinked privacy legal-review retained artifact before JSON ingestion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.');
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'knowme-privacy-legal-binding-symlink-'));
  try {
    const targetPath = join(dir, 'privacy-legal-review-target.json');
    const artifactPath = join(dir, 'privacy-legal-review-link.json');
    const outputPath = join(dir, 'item.json');
    await writeFile(targetPath, `${JSON.stringify(artifact(), null, 2)}\n`);
    await symlink(targetPath, artifactPath);

    const result = spawnSync(process.execPath, cliArgs(artifactPath, outputPath), { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(existsSync(outputPath), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
