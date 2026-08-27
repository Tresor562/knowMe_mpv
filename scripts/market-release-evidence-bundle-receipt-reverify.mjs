#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyMarketReleaseEvidenceBundle } from './market-release-evidence-bundle-verify.mjs';
import { verifyMarketReleaseEvidenceBundleReceipt } from './market-release-evidence-bundle-receipt-verify.mjs';

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
  now = new Date(),
}) {
  const errors = [];
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
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  console.log(`Reverified authenticated release receipt against exact bundle: ${receiptPath}`);
  console.log(`Receipt SHA-256: ${result.receiptSha256}`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
  console.log('This verifies retained receipt-to-bundle integrity and authenticity only; external evidence truthfulness remains independently required.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release receipt-to-bundle reverification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
