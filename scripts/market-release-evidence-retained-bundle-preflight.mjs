#!/usr/bin/env node

import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import {
  reverifyMarketReleaseEvidenceBundleReceipt,
  resolveReceiptFreshnessPolicy,
} from './market-release-evidence-bundle-receipt-reverify.mjs';

export const RETAINED_RELEASE_ARTIFACT_LIMITS = Object.freeze({
  manifest: 256 * 1024,
  receipt: 128 * 1024,
  digest: 512,
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertBoundedRegularFile(stat, { label, maxBytes }) {
  if (!stat.isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
  if (!Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > maxBytes) {
    throw new Error(`${label} must contain between 1 and ${maxBytes} bytes.`);
  }
}

export async function readRetainedReleaseArtifact(path, { label, maxBytes, encoding } = {}) {
  if (!nonEmpty(path)) throw new Error(`${label ?? 'Retained release artifact'} path is required.`);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Retained release artifact maxBytes must be a positive safe integer.');
  }

  const before = await lstat(path);
  if (before.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link.`);
  }
  assertBoundedRegularFile(before, { label, maxBytes });

  const noFollow = Number.isInteger(constants.O_NOFOLLOW) ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ELOOP') {
      throw new Error(`${label} must not be a symbolic link.`);
    }
    throw error;
  }

  try {
    const opened = await handle.stat();
    assertBoundedRegularFile(opened, { label, maxBytes });
    if (before.dev !== opened.dev || before.ino !== opened.ino) {
      throw new Error(`${label} changed while it was being opened.`);
    }

    const bytes = await handle.readFile();
    const after = await handle.stat();
    assertBoundedRegularFile(after, { label, maxBytes });
    if (
      opened.dev !== after.dev ||
      opened.ino !== after.ino ||
      opened.size !== after.size ||
      opened.mtimeMs !== after.mtimeMs ||
      bytes.length !== after.size
    ) {
      throw new Error(`${label} changed while it was being read.`);
    }

    return encoding ? bytes.toString(encoding) : bytes;
  } finally {
    await handle.close();
  }
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
    readRetainedReleaseArtifact(receiptPath, {
      label: 'Retained market release receipt',
      maxBytes: RETAINED_RELEASE_ARTIFACT_LIMITS.receipt,
    }),
    readRetainedReleaseArtifact(manifestPath, {
      label: 'Retained market release manifest',
      maxBytes: RETAINED_RELEASE_ARTIFACT_LIMITS.manifest,
    }),
    readRetainedReleaseArtifact(digestPath, {
      label: 'Retained market release digest',
      maxBytes: RETAINED_RELEASE_ARTIFACT_LIMITS.digest,
      encoding: 'utf8',
    }),
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
  console.log('Market readiness is bound to bounded regular retained files plus the exact signed manifest, digest, authenticated receipt, candidate identity, and configured receipt freshness policy.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Retained market release bundle gate failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
