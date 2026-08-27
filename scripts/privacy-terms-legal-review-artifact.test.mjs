import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPrivacyTermsLegalReviewArtifact,
  validatePrivacyLegalReviewRecord,
  writePrivacyTermsLegalReviewArtifact,
} from './privacy-terms-legal-review-artifact.mjs';

const NOW = new Date('2026-08-28T00:30:00.000Z');
const CONFIRMATION = 'PRIVACY_LEGAL_REVIEW_COMPLETED';

function record(overrides = {}) {
  const completedAt = '2026-08-28T00:20:00.000Z';
  return {
    schemaVersion: 1,
    kind: 'knowme-privacy-terms-legal-review-record',
    environment: 'PRODUCTION',
    status: 'PASSED',
    observedAt: '2026-08-28T00:25:00.000Z',
    checks: {
      privacyPolicyReview: { status: 'PASSED', completedAt },
      termsReview: { status: 'PASSED', completedAt },
      consentReview: { status: 'PASSED', completedAt },
      dataLifecycleReview: { status: 'PASSED', completedAt },
      minorsAgeGateReview: { status: 'PASSED', completedAt },
      processorSubprocessorReview: { status: 'PASSED', completedAt },
    },
    ...overrides,
  };
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd296-'));
  const privacyPolicyPath = join(dir, 'privacy.md');
  const termsPath = join(dir, 'terms.md');
  const consentNoticePath = join(dir, 'consent.md');
  const legalReviewRecordPath = join(dir, 'legal-review.json');
  const outputPath = join(dir, 'artifact.json');
  const privacyPolicyBytes = Buffer.from('# Privacy policy\nRetained production copy.\n');
  const termsBytes = Buffer.from('# Terms\nRetained production copy.\n');
  const consentNoticeBytes = Buffer.from('# Consent notice\nRetained production copy.\n');
  const legalReviewRecordBytes = Buffer.from(`${JSON.stringify(record(), null, 2)}\n`);
  await writeFile(privacyPolicyPath, privacyPolicyBytes);
  await writeFile(termsPath, termsBytes);
  await writeFile(consentNoticePath, consentNoticeBytes);
  await writeFile(legalReviewRecordPath, legalReviewRecordBytes);
  return {
    dir,
    privacyPolicyPath,
    termsPath,
    consentNoticePath,
    legalReviewRecordPath,
    outputPath,
    privacyPolicyBytes,
    termsBytes,
    consentNoticeBytes,
    legalReviewRecordBytes,
  };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('validates the exact six-check production privacy/legal review record', () => {
  assert.deepEqual(validatePrivacyLegalReviewRecord(record(), { now: NOW }), {
    ok: true,
    observedAt: '2026-08-28T00:25:00.000Z',
  });
});

test('rejects unknown fields, incomplete checks, future checks, and non-passed checks', () => {
  assert.equal(validatePrivacyLegalReviewRecord({ ...record(), extra: true }, { now: NOW }).ok, false);

  const incomplete = record();
  delete incomplete.checks.dataLifecycleReview;
  assert.equal(validatePrivacyLegalReviewRecord(incomplete, { now: NOW }).ok, false);

  const future = record();
  future.checks.termsReview.completedAt = '2026-08-28T00:40:00.000Z';
  assert.equal(validatePrivacyLegalReviewRecord(future, { now: NOW }).ok, false);

  const failed = record();
  failed.checks.minorsAgeGateReview.status = 'FAILED';
  assert.equal(validatePrivacyLegalReviewRecord(failed, { now: NOW }).ok, false);
});

test('binds exact retained document bytes into the KMD-294 artifact contract', async () => {
  const fx = await fixture();
  const artifact = await buildPrivacyTermsLegalReviewArtifact({
    privacyPolicyPath: fx.privacyPolicyPath,
    termsPath: fx.termsPath,
    consentNoticePath: fx.consentNoticePath,
    legalReviewRecordPath: fx.legalReviewRecordPath,
    confirmation: CONFIRMATION,
    now: NOW,
  });

  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, 'knowme-privacy-terms-legal-review');
  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.environment, 'PRODUCTION');
  assert.equal(artifact.observedAt, '2026-08-28T00:25:00.000Z');
  assert.equal(artifact.privacyPolicySha256, sha256(fx.privacyPolicyBytes));
  assert.equal(artifact.termsSha256, sha256(fx.termsBytes));
  assert.equal(artifact.consentNoticeSha256, sha256(fx.consentNoticeBytes));
  assert.equal(artifact.legalReviewRecordSha256, sha256(fx.legalReviewRecordBytes));
  assert.deepEqual(Object.values(artifact.checks), Array(6).fill('PASSED'));
});

test('requires the exact explicit review completion confirmation', async () => {
  const fx = await fixture();
  await assert.rejects(
    buildPrivacyTermsLegalReviewArtifact({
      privacyPolicyPath: fx.privacyPolicyPath,
      termsPath: fx.termsPath,
      consentNoticePath: fx.consentNoticePath,
      legalReviewRecordPath: fx.legalReviewRecordPath,
      confirmation: 'yes',
      now: NOW,
    }),
    /PRIVACY_LEGAL_REVIEW_COMPLETED/,
  );
});

test('rejects symlink inputs and malformed legal-review JSON', async () => {
  const fx = await fixture();
  const symlinkPath = join(fx.dir, 'privacy-link.md');
  await symlink(fx.privacyPolicyPath, symlinkPath);
  await assert.rejects(
    buildPrivacyTermsLegalReviewArtifact({
      privacyPolicyPath: symlinkPath,
      termsPath: fx.termsPath,
      consentNoticePath: fx.consentNoticePath,
      legalReviewRecordPath: fx.legalReviewRecordPath,
      confirmation: CONFIRMATION,
      now: NOW,
    }),
    /regular non-symlink file/,
  );

  await writeFile(fx.legalReviewRecordPath, '{bad json');
  await assert.rejects(
    buildPrivacyTermsLegalReviewArtifact({
      privacyPolicyPath: fx.privacyPolicyPath,
      termsPath: fx.termsPath,
      consentNoticePath: fx.consentNoticePath,
      legalReviewRecordPath: fx.legalReviewRecordPath,
      confirmation: CONFIRMATION,
      now: NOW,
    }),
    /valid JSON/,
  );
});

test('writes exclusively and preserves a pre-existing artifact', async () => {
  const fx = await fixture();
  const artifact = await buildPrivacyTermsLegalReviewArtifact({
    privacyPolicyPath: fx.privacyPolicyPath,
    termsPath: fx.termsPath,
    consentNoticePath: fx.consentNoticePath,
    legalReviewRecordPath: fx.legalReviewRecordPath,
    confirmation: CONFIRMATION,
    now: NOW,
  });

  const first = await writePrivacyTermsLegalReviewArtifact(fx.outputPath, artifact);
  assert.equal(first.sha256, sha256(first.bytes));
  const original = await readFile(fx.outputPath);

  await assert.rejects(writePrivacyTermsLegalReviewArtifact(fx.outputPath, { ...artifact, observedAt: NOW.toISOString() }), {
    code: 'EEXIST',
  });
  assert.deepEqual(await readFile(fx.outputPath), original);
});
