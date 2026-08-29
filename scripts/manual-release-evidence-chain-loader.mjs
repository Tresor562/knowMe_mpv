import { lstat, readFile } from 'node:fs/promises';
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

async function readRegularFile(path, label, encoding) {
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }
  return readFile(path, encoding);
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
