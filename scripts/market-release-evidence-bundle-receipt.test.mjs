import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { finalizeMarketReleaseEvidence } from './market-release-evidence-finalize.mjs';
import {
  buildMarketReleaseEvidenceBundleReceipt,
  writeMarketReleaseEvidenceBundleReceipt,
} from './market-release-evidence-bundle-receipt.mjs';

const commit = 'a'.repeat(40);
const version = '1.0.0-rc.1';
const signingKeyId = 'release-key-1';
const signingKey = 'k'.repeat(48);
const now = new Date('2026-08-27T01:45:00.000Z');
const artifactSha = 'b'.repeat(64);
const manifestPath = '/tmp/release-evidence.signed.json';
const digestPath = '/tmp/release-evidence.signed.sha256';

function pending(id) {
  return { id, status: 'PENDING', verifiedAt: null, validUntil: null, verifier: null, evidenceRef: null, evidenceSha256: null };
}

function item(id) {
  return {
    id,
    status: 'VERIFIED',
    verifiedAt: '2026-08-27T01:30:00.000Z',
    validUntil: '2026-09-03T01:30:00.000Z',
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

function build(overrides = {}) {
  const result = finalized();
  return buildMarketReleaseEvidenceBundleReceipt({
    manifestBytes: result.bytes,
    digestText: `${result.sha256}  ${manifestPath}\n`,
    manifestPath,
    digestPath,
    expectedCommit: commit,
    expectedVersion: version,
    expectedSigningKeyId: signingKeyId,
    signingKey,
    now,
    ...overrides,
  });
}

test('creates a bounded receipt only after full bundle verification', () => {
  const result = build();
  assert.equal(result.ok, true);
  assert.equal(result.receipt.releaseCommit, commit);
  assert.equal(result.receipt.releaseVersion, version);
  assert.equal(result.receipt.scope, 'WEB_V1');
  assert.equal(result.receipt.signingKeyId, signingKeyId);
  assert.match(result.receipt.manifestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.receipt.digestSha256, /^[0-9a-f]{64}$/);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal('signingKey' in result.receipt, false);
});

test('does not create a receipt for tampered manifest bytes', () => {
  const good = finalized();
  const parsed = JSON.parse(good.bytes.toString('utf8'));
  parsed.releaseVersion = '1.0.1';
  const tampered = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  const result = build({ manifestBytes: tampered });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /SHA-256 does not match|releaseVersion|HMAC|Hmac/);
});

test('refuses ambiguous artifact paths before emitting a receipt', () => {
  const result = build({ digestPath: '/tmp/release\nforged.sha256' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Digest record path must be canonical/);
});

test('receipt binds the exact digest record bytes', () => {
  const good = finalized();
  const first = build({ digestText: `${good.sha256}  ${manifestPath}\n` });
  const second = build({ digestText: `${good.sha256}  ${manifestPath}\r\n` });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
});

test('writes receipt exclusively and never overwrites an existing artifact', async () => {
  const result = build();
  assert.equal(result.ok, true);
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd273-'));
  const output = join(dir, 'verification-receipt.json');
  await writeMarketReleaseEvidenceBundleReceipt({ outputPath: output, bytes: result.bytes });
  const stored = await readFile(output);
  assert.deepEqual(stored, result.bytes);
  await assert.rejects(
    writeMarketReleaseEvidenceBundleReceipt({ outputPath: output, bytes: result.bytes }),
    /EEXIST/,
  );
});

test('rejects control characters in the receipt output path', async () => {
  const result = build();
  await assert.rejects(
    writeMarketReleaseEvidenceBundleReceipt({ outputPath: '/tmp/receipt\nforged.json', bytes: result.bytes }),
    /canonical, bounded, and free of control characters/,
  );
});
