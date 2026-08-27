import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import {
  finalizeMarketReleaseEvidence,
  writeFinalizedMarketReleaseEvidence,
} from './market-release-evidence-finalize.mjs';
import {
  parseMarketReleaseEvidenceDigestRecord,
  verifyMarketReleaseEvidenceBundle,
} from './market-release-evidence-bundle-verify.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-27T00:30:00.000Z');
const artifactSha = 'b'.repeat(64);
const manifestPath = '/tmp/release-evidence.signed.json';

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-27T00:25:00.000Z',
    validUntil: '2026-09-03T00:25:00.000Z',
    verifier: 'release-operator',
    evidenceRef: `evidence://release/${id}.json`,
    evidenceSha256: artifactSha,
  };
}

function finalized() {
  const source = {
    schemaVersion: 4,
    scope: 'WEB_V1',
    environment: 'PRODUCTION',
    releaseCommit: commit,
    releaseVersion: version,
    signingKeyId,
    evidence: requiredEvidenceForScope('WEB_V1').map(pending),
    manifestHmacSha256: '0'.repeat(64),
  };
  const result = finalizeMarketReleaseEvidence(source, requiredEvidenceForScope('WEB_V1').map(item), {
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
  });
  assert.equal(result.ok, true);
  return result;
}

function verify(result = finalized(), overrides = {}) {
  return verifyMarketReleaseEvidenceBundle({
    manifestBytes: result.bytes,
    digestText: `${result.sha256}  ${manifestPath}\n`,
    manifestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  });
}

test('verifies exact finalized bytes, digest pairing, HMAC, commit, and version', () => {
  const result = finalized();
  const verification = verify(result);
  assert.equal(verification.ok, true);
  assert.equal(verification.sha256, result.sha256);
  assert.equal(verification.manifest.releaseCommit, commit);
  assert.equal(verification.manifest.releaseVersion, version);
});

test('rejects a digest that names a different manifest path', () => {
  const result = finalized();
  const verification = verify(result, {
    digestText: `${result.sha256}  /tmp/other.signed.json\n`,
  });
  assert.equal(verification.ok, false);
  assert.match(verification.errors.join(' '), /does not name the signed manifest/);
});

test('rejects CRLF and multi-line digest records', () => {
  const result = finalized();
  const crlf = verify(result, { digestText: `${result.sha256}  ${manifestPath}\r\n` });
  assert.equal(crlf.ok, false);
  assert.match(crlf.errors.join(' '), /canonical LF|canonical SHA-256 line/);

  const multiline = verify(result, { digestText: `${result.sha256}  ${manifestPath}\nextra\n` });
  assert.equal(multiline.ok, false);
  assert.match(multiline.errors.join(' '), /exactly one canonical SHA-256 line/);
});

test('rejects tampered manifest bytes even when JSON remains valid', () => {
  const result = finalized();
  const parsed = JSON.parse(result.bytes.toString('utf8'));
  parsed.releaseVersion = '1.0.1';
  const tamperedBytes = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  const verification = verify(result, { manifestBytes: tamperedBytes });
  assert.equal(verification.ok, false);
  assert.match(verification.errors.join(' '), /SHA-256 does not match|Hmac|HMAC|releaseVersion/);
});

test('rejects non-canonical JSON bytes even if semantic content and digest are recomputed', () => {
  const result = finalized();
  const compact = Buffer.from(JSON.stringify(result.manifest), 'utf8');
  const compactSha = createHash('sha256').update(compact).digest('hex');
  const verification = verify(result, {
    manifestBytes: compact,
    digestText: `${compactSha}  ${manifestPath}\n`,
  });
  assert.equal(verification.ok, false);
  assert.match(verification.errors.join(' '), /canonical finalized JSON representation/);
});

test('rejects expected release identity mismatch even when bundle bytes are intact', () => {
  const result = finalized();
  const wrongCommit = verify(result, { expectedCommit: 'c'.repeat(40) });
  assert.equal(wrongCommit.ok, false);
  assert.match(wrongCommit.errors.join(' '), /releaseCommit does not match/);

  const wrongVersion = verify(result, { expectedVersion: '1.0.1' });
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.errors.join(' '), /releaseVersion does not match/);
});

test('digest parser rejects control characters in the recorded path', () => {
  const sha = 'd'.repeat(64);
  const parsed = parseMarketReleaseEvidenceDigestRecord(`${sha}  /tmp/release\tfile.json\n`, '/tmp/release\tfile.json');
  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(' '), /free of control characters/);
});

test('finalizer refuses paths that could inject extra digest-record lines', async () => {
  const result = finalized();
  await assert.rejects(
    writeFinalizedMarketReleaseEvidence({
      outputPath: '/tmp/release-evidence.signed.json\nforged',
      digestPath: '/tmp/release-evidence.signed.sha256',
      bytes: result.bytes,
      sha256: result.sha256,
    }),
    /control characters/,
  );
});
