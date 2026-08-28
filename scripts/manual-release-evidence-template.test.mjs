import assert from 'node:assert/strict';
import test from 'node:test';
import { createManualReleaseEvidenceTemplate } from './manual-release-evidence-template.mjs';

const COMMIT = 'a'.repeat(40);
const VERSION = '1.2.3';
const EXPECTED_IDS = [
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
];

test('creates a release-bound pending template for every manual FULL evidence requirement', () => {
  const result = createManualReleaseEvidenceTemplate({ releaseCommit: COMMIT, releaseVersion: VERSION });
  assert.equal(result.ok, true);
  const template = result.template;

  assert.equal(template.schemaVersion, 1);
  assert.equal(template.templateOnly, true);
  assert.equal(template.certifiesValidation, false);
  assert.equal(template.environment, 'PRODUCTION');
  assert.equal(template.generatedForScope, 'FULL');
  assert.equal(template.releaseCommit, COMMIT);
  assert.equal(template.releaseVersion, VERSION);
  assert.deepEqual(template.evidence.map((entry) => entry.id), EXPECTED_IDS);

  for (const entry of template.evidence) {
    assert.equal(entry.status, 'PENDING_MANUAL_VALIDATION');
    assert.equal(entry.validation.occurredAt, null);
    assert.equal(entry.validation.accountableActorOrRole, null);
    assert.equal(entry.validation.outcome, null);
    assert.equal(entry.retainedProof.uri, null);
    assert.equal(entry.retainedProof.sha256, null);
    assert.ok(entry.attestations.length > 0);
    for (const attestation of entry.attestations) {
      assert.equal(typeof attestation.requirement, 'string');
      assert.ok(attestation.requirement.length > 0);
      assert.equal(attestation.satisfied, null);
      assert.equal(attestation.reference, null);
    }
  }
});

test('retains device-specific and store-specific proof requirements from the canonical action plan', () => {
  const { template } = createManualReleaseEvidenceTemplate({ releaseCommit: COMMIT, releaseVersion: VERSION });
  const byId = new Map(template.evidence.map((entry) => [entry.id, entry]));

  assert.ok(byId.get('ios_physical_validation').attestations.some(({ requirement }) => requirement.includes('device model')));
  assert.ok(byId.get('android_physical_validation').attestations.some(({ requirement }) => requirement.includes('manufacturer/model')));
  assert.ok(byId.get('ios_store_submission').attestations.some(({ requirement }) => requirement.includes('App Store Connect')));
  assert.ok(byId.get('android_store_submission').attestations.some(({ requirement }) => requirement.includes('Google Play Console')));
});

test('fails closed on non-canonical release metadata', () => {
  const badCommit = createManualReleaseEvidenceTemplate({ releaseCommit: 'ABC', releaseVersion: VERSION });
  assert.equal(badCommit.ok, false);
  assert.match(badCommit.errors.join(' '), /releaseCommit/);

  const badVersion = createManualReleaseEvidenceTemplate({ releaseCommit: COMMIT, releaseVersion: 'v1.2.3' });
  assert.equal(badVersion.ok, false);
  assert.match(badVersion.errors.join(' '), /releaseVersion/);
});

test('template cannot be confused with a verified or signed market evidence manifest', () => {
  const { template } = createManualReleaseEvidenceTemplate({ releaseCommit: COMMIT, releaseVersion: VERSION });
  assert.equal('manifestHmacSha256' in template, false);
  assert.equal('signingKeyId' in template, false);
  assert.ok(template.evidence.every((entry) => entry.status !== 'VERIFIED'));
  assert.match(template.proofBoundary, /certifies nothing|does not .*certify/i);
});
