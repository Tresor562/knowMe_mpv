#!/usr/bin/env node

import { createGenericMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

const MANUAL_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);
const issuedAuthorizations = new WeakSet();

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

  const authorization = Object.freeze({
    evidenceId: item.id,
    releaseCommit: expectedCommit,
    releaseVersion: expectedVersion,
    itemJson: exactJson(item),
  });
  issuedAuthorizations.add(authorization);
  return { ok: true, authorization };
}

export function validateManualReleaseEvidencePromotionAuthorization(
  authorization,
  item,
  { expectedCommit, expectedVersion } = {},
) {
  if (!authorization || typeof authorization !== 'object' || !issuedAuthorizations.has(authorization)) {
    return { ok: false, errors: ['manual evidence requires an authorization minted by the reviewed promotion preflight in this process.'] };
  }
  if (
    authorization.evidenceId !== item?.id ||
    authorization.releaseCommit !== expectedCommit ||
    authorization.releaseVersion !== expectedVersion ||
    authorization.itemJson !== exactJson(item)
  ) {
    return { ok: false, errors: ['manual promotion authorization does not match the exact evidence item and target release.'] };
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
    readRetainedEvidenceFile(itemPath, 'manual evidence item', {
      encoding: 'utf8',
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.item,
    }),
    readRetainedEvidenceFile(artifactPath, 'retained artifact', {
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
    }),
    readRetainedEvidenceFile(worksheetPath, 'manual evidence worksheet', {
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.worksheet,
    }),
    readRetainedEvidenceFile(reviewReceiptPath, 'manual evidence review receipt', {
      encoding: 'utf8',
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.reviewReceipt,
    }),
  ]);

  let item;
  let reviewReceipt;
  try {
    item = JSON.parse(itemRaw);
  } catch {
    throw new Error('manual evidence item must contain valid JSON.');
  }
  try {
    reviewReceipt = JSON.parse(reviewReceiptRaw);
  } catch {
    throw new Error('manual evidence review receipt must contain valid JSON.');
  }

  const result = preflightManualReleaseEvidencePromotion(
    item,
    artifactBytes,
    worksheetBytes,
    reviewReceipt,
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
