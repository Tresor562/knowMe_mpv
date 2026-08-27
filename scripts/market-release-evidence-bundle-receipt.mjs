#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { verifyMarketReleaseEvidenceBundle } from './market-release-evidence-bundle-verify.mjs';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SHA256 = /^[0-9a-f]{64}$/;
const MIN_SIGNING_KEY_LENGTH = 32;
const RECEIPT_HMAC_DOMAIN = 'knowme-market-release-bundle-verification-receipt-v2\n';

function canonicalArtifactPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4096 &&
    value === value.trim() &&
    !CONTROL_CHARACTERS.test(value)
  );
}

function canonicalIsoInstant(value) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function validSigningKey(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= MIN_SIGNING_KEY_LENGTH;
}

function receiptPayload(receipt) {
  return {
    schemaVersion: 2,
    kind: 'knowme-market-release-bundle-verification',
    verifiedAt: receipt.verifiedAt,
    releaseCommit: receipt.releaseCommit,
    releaseVersion: receipt.releaseVersion,
    scope: receipt.scope,
    signingKeyId: receipt.signingKeyId,
    manifestPath: receipt.manifestPath,
    manifestSha256: receipt.manifestSha256,
    digestPath: receipt.digestPath,
    digestSha256: receipt.digestSha256,
    proofBoundary: receipt.proofBoundary,
  };
}

export function computeMarketReleaseEvidenceBundleReceiptHmac(receipt, signingKey) {
  if (!validSigningKey(signingKey)) {
    throw new Error(`Release evidence signing key must be at least ${MIN_SIGNING_KEY_LENGTH} canonical characters.`);
  }
  return createHmac('sha256', signingKey)
    .update(RECEIPT_HMAC_DOMAIN)
    .update(JSON.stringify(receiptPayload(receipt)))
    .digest('hex');
}

export function buildMarketReleaseEvidenceBundleReceipt({
  manifestBytes,
  digestText,
  manifestPath,
  digestPath,
  expectedCommit,
  expectedVersion,
  expectedSigningKeyId,
  signingKey,
  now = new Date(),
}) {
  const errors = [];
  if (!canonicalArtifactPath(manifestPath)) {
    errors.push('Signed manifest path must be canonical, bounded, and free of control characters.');
  }
  if (!canonicalArtifactPath(digestPath)) {
    errors.push('Digest record path must be canonical, bounded, and free of control characters.');
  }
  const verifiedAt = canonicalIsoInstant(now);
  if (!verifiedAt) errors.push('Verification receipt timestamp must be a valid instant.');
  if (!validSigningKey(signingKey)) {
    errors.push(`Release evidence signing key must be at least ${MIN_SIGNING_KEY_LENGTH} canonical characters.`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const verification = verifyMarketReleaseEvidenceBundle({
    manifestBytes,
    digestText,
    manifestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!verification.ok) return { ok: false, errors: verification.errors };

  const digestSha256 = createHash('sha256').update(Buffer.from(digestText, 'utf8')).digest('hex');
  const receipt = {
    schemaVersion: 2,
    kind: 'knowme-market-release-bundle-verification',
    verifiedAt,
    releaseCommit: verification.manifest.releaseCommit,
    releaseVersion: verification.manifest.releaseVersion,
    scope: verification.manifest.scope,
    signingKeyId: verification.manifest.signingKeyId,
    manifestPath,
    manifestSha256: verification.sha256,
    digestPath,
    digestSha256,
    proofBoundary:
      'Bundle integrity, authenticity, release identity, and manifest completeness verified; external evidence truthfulness remains independently required.',
    receiptHmacSha256: '0'.repeat(64),
  };
  receipt.receiptHmacSha256 = computeMarketReleaseEvidenceBundleReceiptHmac(receipt, signingKey);
  if (!SHA256.test(receipt.receiptHmacSha256)) {
    return { ok: false, errors: ['Verification receipt HMAC generation failed.'] };
  }
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { ok: true, errors: [], receipt, bytes, sha256 };
}

export async function writeMarketReleaseEvidenceBundleReceipt({ outputPath, bytes }) {
  if (!canonicalArtifactPath(outputPath)) {
    throw new Error('Verification receipt output path must be canonical, bounded, and free of control characters.');
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error('Verification receipt bytes must be non-empty.');
  }

  let handle;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw error;
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const manifestPath = readArg('--manifest');
  const digestPath = readArg('--digest');
  const outputPath = readArg('--output');
  if (!manifestPath || !digestPath || !outputPath) {
    throw new Error('Provide --manifest <signed-manifest.json> --digest <sha256-file> --output <verification-receipt.json>.');
  }

  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;
  const [manifestBytes, digestText] = await Promise.all([
    readFile(manifestPath),
    readFile(digestPath, 'utf8'),
  ]);

  const result = buildMarketReleaseEvidenceBundleReceipt({
    manifestBytes,
    digestText,
    manifestPath,
    digestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeMarketReleaseEvidenceBundleReceipt({ outputPath, bytes: result.bytes });
  console.log(`Wrote authenticated market release bundle receipt: ${outputPath}`);
  console.log(`Receipt SHA-256: ${result.sha256}`);
  console.log(result.receipt.proofBoundary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release bundle verification receipt failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
