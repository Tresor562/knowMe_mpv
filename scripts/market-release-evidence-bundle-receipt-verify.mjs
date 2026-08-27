#!/usr/bin/env node

import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { computeMarketReleaseEvidenceBundleReceiptHmac } from './market-release-evidence-bundle-receipt.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SIGNING_KEY_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const RECEIPT_KEYS = new Set([
  'schemaVersion',
  'kind',
  'verifiedAt',
  'releaseCommit',
  'releaseVersion',
  'scope',
  'signingKeyId',
  'manifestPath',
  'manifestSha256',
  'digestPath',
  'digestSha256',
  'proofBoundary',
  'receiptHmacSha256',
]);

function canonicalPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096 && value === value.trim() && !CONTROL_CHARACTERS.test(value);
}

function canonicalIso(value) {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function safeEqualHex(left, right) {
  if (!SHA256.test(left) || !SHA256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifyMarketReleaseEvidenceBundleReceipt({
  receiptBytes,
  expectedCommit,
  expectedVersion,
  expectedSigningKeyId,
  signingKey,
  now = new Date(),
}) {
  const errors = [];
  if (!Buffer.isBuffer(receiptBytes) || receiptBytes.length === 0 || receiptBytes.length > 64 * 1024) {
    return { ok: false, errors: ['Verification receipt bytes must be non-empty and no larger than 64 KiB.'] };
  }

  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString('utf8'));
  } catch {
    return { ok: false, errors: ['Verification receipt must be valid JSON.'] };
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, errors: ['Verification receipt must be a JSON object.'] };
  }

  for (const key of Object.keys(receipt)) {
    if (!RECEIPT_KEYS.has(key)) errors.push(`Unknown verification receipt field: ${key}.`);
  }
  if (Object.keys(receipt).length !== RECEIPT_KEYS.size || [...RECEIPT_KEYS].some((key) => !(key in receipt))) {
    errors.push('Verification receipt must contain exactly the documented schema fields.');
  }
  if (receipt.schemaVersion !== 2) errors.push('Verification receipt schemaVersion must be 2.');
  if (receipt.kind !== 'knowme-market-release-bundle-verification') errors.push('Verification receipt kind is invalid.');
  if (!canonicalIso(receipt.verifiedAt)) errors.push('Verification receipt verifiedAt must be a canonical ISO instant.');
  if (!SHA40.test(receipt.releaseCommit ?? '')) errors.push('Verification receipt releaseCommit must be a lowercase 40-character Git SHA.');
  if (!RELEASE_VERSION.test(receipt.releaseVersion ?? '')) errors.push('Verification receipt releaseVersion must be canonical SemVer.');
  if (!['WEB_V1', 'FULL'].includes(receipt.scope)) errors.push('Verification receipt scope must be WEB_V1 or FULL.');
  if (!SIGNING_KEY_ID.test(receipt.signingKeyId ?? '')) errors.push('Verification receipt signingKeyId must be canonical.');
  if (!canonicalPath(receipt.manifestPath)) errors.push('Verification receipt manifestPath must be canonical.');
  if (!SHA256.test(receipt.manifestSha256 ?? '')) errors.push('Verification receipt manifestSha256 must be canonical lowercase SHA-256.');
  if (!canonicalPath(receipt.digestPath)) errors.push('Verification receipt digestPath must be canonical.');
  if (!SHA256.test(receipt.digestSha256 ?? '')) errors.push('Verification receipt digestSha256 must be canonical lowercase SHA-256.');
  if (typeof receipt.proofBoundary !== 'string' || receipt.proofBoundary.length < 32 || receipt.proofBoundary.length > 512 || receipt.proofBoundary !== receipt.proofBoundary.trim() || CONTROL_CHARACTERS.test(receipt.proofBoundary)) {
    errors.push('Verification receipt proofBoundary must be canonical and bounded.');
  }
  if (!SHA256.test(receipt.receiptHmacSha256 ?? '')) errors.push('Verification receipt HMAC must be canonical lowercase SHA-256.');

  if (!SHA40.test(expectedCommit ?? '')) errors.push('Expected release commit must be an explicit lowercase 40-character Git SHA.');
  if (!RELEASE_VERSION.test(expectedVersion ?? '')) errors.push('Expected release version must be explicit canonical SemVer.');
  if (!SIGNING_KEY_ID.test(expectedSigningKeyId ?? '')) errors.push('Expected signing key id must be explicit and canonical.');
  if (receipt.releaseCommit !== expectedCommit) errors.push('Verification receipt releaseCommit does not match the expected candidate.');
  if (receipt.releaseVersion !== expectedVersion) errors.push('Verification receipt releaseVersion does not match the expected candidate.');
  if (receipt.signingKeyId !== expectedSigningKeyId) errors.push('Verification receipt signingKeyId does not match the active key id.');

  const nowTime = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(nowTime)) errors.push('Verification time must be valid.');
  if (canonicalIso(receipt.verifiedAt) && Number.isFinite(nowTime) && new Date(receipt.verifiedAt).getTime() > nowTime) {
    errors.push('Verification receipt timestamp cannot be in the future.');
  }

  let expectedHmac;
  try {
    expectedHmac = computeMarketReleaseEvidenceBundleReceiptHmac(receipt, signingKey);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (expectedHmac && !safeEqualHex(receipt.receiptHmacSha256, expectedHmac)) {
    errors.push('Verification receipt HMAC does not match its authenticated contents.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    receipt,
    sha256: createHash('sha256').update(receiptBytes).digest('hex'),
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const receiptPath = readArg('--receipt');
  if (!receiptPath) throw new Error('Provide --receipt <verification-receipt.json>.');
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;
  const receiptBytes = await readFile(receiptPath);
  const result = verifyMarketReleaseEvidenceBundleReceipt({
    receiptBytes,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  console.log(`Verified authenticated market release bundle receipt: ${receiptPath}`);
  console.log(`Receipt SHA-256: ${result.sha256}`);
  console.log(result.receipt.proofBoundary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release bundle receipt verification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
