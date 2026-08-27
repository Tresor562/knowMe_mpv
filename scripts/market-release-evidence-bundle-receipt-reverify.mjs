#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyMarketReleaseEvidenceBundle } from './market-release-evidence-bundle-verify.mjs';
import { verifyMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt-verify.mjs';

export const MAX_RECEIPT_AGE_HOURS = 8760;

export function parseCanonicalReceiptMaxAgeHours(value, label = 'Receipt maximum age hours') {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAX_RECEIPT_AGE_HOURS) {
      throw new Error(`${label} must be an integer between 1 and ${MAX_RECEIPT_AGE_HOURS}.`);
    }
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a canonical positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_RECEIPT_AGE_HOURS) {
    throw new Error(`${label} must be between 1 and ${MAX_RECEIPT_AGE_HOURS}.`);
  }
  return parsed;
}

export function resolveReceiptFreshnessPolicy({ configuredMaxAgeHours, requestedMaxAgeHours }) {
  if (configuredMaxAgeHours === undefined || configuredMaxAgeHours === null || configuredMaxAgeHours === '') {
    throw new Error('KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS must be configured before receipt reverification.');
  }
  const configured = parseCanonicalReceiptMaxAgeHours(
    configuredMaxAgeHours,
    'KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS',
  );
  if (requestedMaxAgeHours === undefined) return configured;

  const requested = parseCanonicalReceiptMaxAgeHours(requestedMaxAgeHours, 'Requested receipt maximum age hours');
  if (requested !== configured) {
    throw new Error(
      `Requested receipt maximum age hours must match the configured release policy (${configured}).`,
    );
  }
  return configured;
}

export function reverifyMarketReleaseEvidenceBundleReceipt({
  receiptBytes,
  manifestBytes,
  digestText,
  manifestPath,
  digestPath,
  expectedCommit,
  expectedVersion,
  expectedSigningKeyId,
  signingKey,
  maxAgeHours,
  now = new Date(),
}) {
  const errors = [];
  let boundedMaxAgeHours;
  try {
    boundedMaxAgeHours = parseCanonicalReceiptMaxAgeHours(maxAgeHours);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const receiptVerification = verifyMarketReleaseEvidenceBundleReceipt({
    receiptBytes,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!receiptVerification.ok) errors.push(...receiptVerification.errors);

  const bundleVerification = verifyMarketReleaseEvidenceBundle({
    manifestBytes,
    digestText,
    manifestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!bundleVerification.ok) errors.push(...bundleVerification.errors);

  const receipt = receiptVerification.receipt;
  if (receipt) {
    if (boundedMaxAgeHours !== undefined) {
      const nowTime = now instanceof Date ? now.getTime() : Number.NaN;
      const verifiedAtTime = new Date(receipt.verifiedAt).getTime();
      if (Number.isFinite(nowTime) && Number.isFinite(verifiedAtTime)) {
        const maximumAgeMs = boundedMaxAgeHours * 60 * 60 * 1000;
        if (nowTime - verifiedAtTime > maximumAgeMs) {
          errors.push(`Verification receipt is older than the allowed ${boundedMaxAgeHours} hour freshness window.`);
        }
      }
    }

    const digestSha256 = createHash('sha256').update(Buffer.from(digestText, 'utf8')).digest('hex');
    if (receipt.manifestPath !== manifestPath) errors.push('Verification receipt manifestPath does not match the supplied signed manifest path.');
    if (receipt.digestPath !== digestPath) errors.push('Verification receipt digestPath does not match the supplied digest path.');
    if (bundleVerification.sha256 && receipt.manifestSha256 !== bundleVerification.sha256) {
      errors.push('Verification receipt manifestSha256 does not match the supplied signed manifest bytes.');
    }
    if (receipt.digestSha256 !== digestSha256) {
      errors.push('Verification receipt digestSha256 does not match the supplied digest bytes.');
    }
    if (bundleVerification.manifest && receipt.scope !== bundleVerification.manifest.scope) {
      errors.push('Verification receipt scope does not match the supplied signed manifest.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    receipt: receiptVerification.receipt,
    manifest: bundleVerification.manifest,
    receiptSha256: receiptVerification.sha256,
    manifestSha256: bundleVerification.sha256,
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const receiptPath = readArg('--receipt');
  const manifestPath = readArg('--manifest');
  const digestPath = readArg('--digest');
  if (!receiptPath || !manifestPath || !digestPath) {
    throw new Error('Provide --receipt <verification-receipt.json> --manifest <signed-manifest.json> --digest <sha256-file>.');
  }

  const maxAgeHours = resolveReceiptFreshnessPolicy({
    configuredMaxAgeHours: process.env.KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS,
    requestedMaxAgeHours: readArg('--max-age-hours'),
  });
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;
  const [receiptBytes, manifestBytes, digestText] = await Promise.all([
    readFile(receiptPath),
    readFile(manifestPath),
    readFile(digestPath, 'utf8'),
  ]);
  const result = reverifyMarketReleaseEvidenceBundleReceipt({
    receiptBytes,
    manifestBytes,
    digestText,
    manifestPath,
    digestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    maxAgeHours,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  console.log(`Reverified authenticated release receipt against exact bundle: ${receiptPath}`);
  console.log(`Receipt SHA-256: ${result.receiptSha256}`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
  console.log(`Receipt freshness window: ${maxAgeHours} hour(s), bound to KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS.`);
  console.log('This verifies retained receipt-to-bundle integrity, authenticity, and bounded receipt freshness only; external evidence truthfulness remains independently required.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release receipt-to-bundle reverification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
