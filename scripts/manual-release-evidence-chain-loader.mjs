import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { preflightManualReleaseEvidencePromotion } from './manual-release-evidence-promotion-preflight.mjs';

export const MANUAL_RELEASE_EVIDENCE_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

const CHAIN_FILES = Object.freeze({
  artifact: 'artifact',
  worksheet: 'worksheet.json',
  reviewReceipt: 'review-receipt.json',
});

function sameFileIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

async function readRegularFile(path, label, encoding) {
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }

  const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    if (error?.code === 'ELOOP') {
      throw new Error(`${label} must be a regular non-symlink file.`);
    }
    throw error;
  }

  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFileIdentity(before, opened)) {
      throw new Error(`${label} changed while being opened; refusing release evidence.`);
    }

    const bytes = await handle.readFile(encoding ? { encoding } : undefined);
    const after = await lstat(path, { bigint: true });
    if (!after.isFile() || after.isSymbolicLink() || !sameFileIdentity(opened, after)) {
      throw new Error(`${label} changed while being read; refusing release evidence.`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

export async function loadManualReleaseEvidenceAuthorizations(
  items,
  manualChainDir,
  { expectedCommit, expectedVersion, now = new Date() } = {},
) {
  if (!Array.isArray(items)) throw new Error('items must be an array.');
  const manualItems = items.filter((item) => MANUAL_RELEASE_EVIDENCE_IDS.has(item?.id));
  if (manualItems.length === 0) return new Map();
  if (typeof manualChainDir !== 'string' || manualChainDir.length === 0 || manualChainDir !== manualChainDir.trim()) {
    throw new Error('--manual-chain-dir is required for FULL manual evidence and must be a canonical path.');
  }
  if (typeof expectedCommit !== 'string' || expectedCommit.length === 0 || typeof expectedVersion !== 'string' || expectedVersion.length === 0) {
    throw new Error('Target release commit and version are required to authorize FULL manual evidence.');
  }

  const ids = manualItems.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('manual evidence items contain duplicate ids.');

  const authorizations = new Map();
  for (const item of [...manualItems].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = join(manualChainDir, item.id);
    const [artifactBytes, worksheetBytes, reviewReceiptRaw] = await Promise.all([
      readRegularFile(join(base, CHAIN_FILES.artifact), `${item.id} retained artifact`),
      readRegularFile(join(base, CHAIN_FILES.worksheet), `${item.id} worksheet`),
      readRegularFile(join(base, CHAIN_FILES.reviewReceipt), `${item.id} review receipt`, 'utf8'),
    ]);

    let reviewReceipt;
    try {
      reviewReceipt = JSON.parse(reviewReceiptRaw);
    } catch {
      throw new Error(`${item.id} review receipt must contain valid JSON.`);
    }

    const result = preflightManualReleaseEvidencePromotion(item, artifactBytes, worksheetBytes, reviewReceipt, {
      expectedCommit,
      expectedVersion,
      now,
    });
    if (!result.ok) throw new Error(`${item.id}: ${result.errors.join(' ')}`);
    authorizations.set(item.id, result.authorization);
  }

  return authorizations;
}
