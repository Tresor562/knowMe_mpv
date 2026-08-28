#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createGenericMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';

const MANUAL_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

function exactJson(value) {
  return JSON.stringify(value);
}

export function preflightManualReleaseEvidencePromotion(
  item,
  artifactBytes,
  worksheetBytes,
  reviewReceipt,
  { expectedCommit, expectedVersion, now = new Date() } = {},
) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, errors: ['item must be a parsed manual release evidence item.'] };
  }
  if (!MANUAL_IDS.has(item.id)) {
    return { ok: false, errors: ['item id must be one of the four FULL physical-device/store evidence ids.'] };
  }

  const rebuilt = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id: item.id,
    scope: 'FULL',
    verifier: item.verifier,
    evidenceRef: item.evidenceRef,
    verifiedAt: item.verifiedAt,
    validUntil: item.validUntil,
    worksheetBytes,
    reviewReceipt,
    expectedCommit,
    expectedVersion,
    now,
  });
  if (!rebuilt.ok) return rebuilt;

  if (exactJson(rebuilt.item) !== exactJson(item)) {
    return {
      ok: false,
      errors: [
        'manual evidence item does not exactly match the item reconstructed from the reviewed worksheet, review receipt, retained proof bytes, and target release.',
      ],
    };
  }

  return { ok: true };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const itemPath = readArg('--item');
  const artifactPath = readArg('--artifact');
  const worksheetPath = readArg('--worksheet');
  const reviewReceiptPath = readArg('--review-receipt');
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;

  if (!itemPath || !artifactPath || !worksheetPath || !reviewReceiptPath || !expectedCommit || !expectedVersion) {
    throw new Error(
      'Provide --item, --artifact, --worksheet, --review-receipt, --commit, and --version (release metadata may also come from canonical environment variables).',
    );
  }

  const [itemRaw, artifactBytes, worksheetBytes, reviewReceiptRaw] = await Promise.all([
    readFile(itemPath, 'utf8'),
    readFile(artifactPath),
    readFile(worksheetPath),
    readFile(reviewReceiptPath, 'utf8'),
  ]);
  const result = preflightManualReleaseEvidencePromotion(
    JSON.parse(itemRaw),
    artifactBytes,
    worksheetBytes,
    JSON.parse(reviewReceiptRaw),
    { expectedCommit, expectedVersion },
  );
  if (!result.ok) throw new Error(result.errors.join(' '));

  console.log('Manual release evidence promotion preflight passed.');
  console.log('The item exactly matches the reviewed worksheet/receipt/proof chain for the target release.');
  console.log('This does not certify that the external physical-device test or store submission actually occurred.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Manual release evidence promotion preflight failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
