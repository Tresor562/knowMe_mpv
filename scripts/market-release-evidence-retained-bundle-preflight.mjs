#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import {
  reverifyMarketReleaseEvidenceBundleReceipt,
  resolveReceiptFreshnessPolicy,
} from './market-release-evidence-bundle-receipt-reverify.mjs';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateRetainedMarketReleaseBundle({
  receiptBytes,
  manifestBytes,
  digestText,
  receiptPath,
  manifestPath,
  digestPath,
  expectedCommit,
  expectedVersion,
  expectedSigningKeyId,
  signingKey,
  maxAgeHours,
  now = new Date(),
}) {
  if (!nonEmpty(receiptPath) || !nonEmpty(manifestPath) || !nonEmpty(digestPath)) {
    return {
      ok: false,
      errors: ['Retained market release gate requires explicit receipt, manifest, and digest paths.'],
    };
  }

  if (receiptPath === manifestPath || receiptPath === digestPath || manifestPath === digestPath) {
    return {
      ok: false,
      errors: ['Retained market release receipt, manifest, and digest paths must be distinct.'],
    };
  }

  return reverifyMarketReleaseEvidenceBundleReceipt({
    receiptBytes,
    manifestBytes,
    digestText,
    receiptPath,
    manifestPath,
    digestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    maxAgeHours,
    now,
  });
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const receiptPath = readArg('--receipt') ?? process.env.KNOWME_RELEASE_EVIDENCE_RECEIPT_FILE;
  const manifestPath = readArg('--manifest') ?? process.env.KNOWME_RELEASE_EVIDENCE_FILE;
  const digestPath = readArg('--digest') ?? process.env.KNOWME_RELEASE_EVIDENCE_DIGEST_FILE;

  if (!nonEmpty(receiptPath) || !nonEmpty(manifestPath) || !nonEmpty(digestPath)) {
    throw new Error(
      'Market readiness requires KNOWME_RELEASE_EVIDENCE_RECEIPT_FILE, KNOWME_RELEASE_EVIDENCE_FILE, and KNOWME_RELEASE_EVIDENCE_DIGEST_FILE (or matching CLI arguments).',
    );
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

  const result = validateRetainedMarketReleaseBundle({
    receiptBytes,
    manifestBytes,
    digestText,
    receiptPath,
    manifestPath,
    digestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    maxAgeHours,
  });

  if (!result.ok) throw new Error(result.errors.join(' '));

  console.log(`Retained market release bundle gate passed for ${result.manifest?.scope ?? 'unknown scope'}.`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
  console.log(`Receipt SHA-256: ${result.receiptSha256}`);
  console.log('Market readiness is bound to the exact retained signed manifest, digest, authenticated receipt, candidate identity, and configured receipt freshness policy.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Retained market release bundle gate failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
