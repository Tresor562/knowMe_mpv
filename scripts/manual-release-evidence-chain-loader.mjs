import { join } from 'node:path';
import { preflightManualReleaseEvidencePromotion } from './manual-release-evidence-promotion-preflight.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';
import {
  assertRetainedEvidenceDirectoryStable,
  snapshotRetainedEvidenceDirectory,
} from './retained-evidence-safe-directory.mjs';

export const MANUAL_RELEASE_EVIDENCE_IDS = new Set([
  'ios_physical_validation',
  'android_physical_validation',
  'ios_store_submission',
  'android_store_submission',
]);

export const MANUAL_RELEASE_EVIDENCE_FILE_LIMITS = RETAINED_EVIDENCE_FILE_LIMITS;

const CHAIN_FILES = Object.freeze({
  artifact: 'artifact',
  worksheet: 'worksheet.json',
  reviewReceipt: 'review-receipt.json',
});

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

  const chainRootIdentity = await snapshotRetainedEvidenceDirectory(manualChainDir, 'manual release evidence chain directory');
  const authorizations = new Map();
  for (const item of [...manualItems].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = join(manualChainDir, item.id);
    const itemDirectoryIdentity = await snapshotRetainedEvidenceDirectory(base, `${item.id} manual evidence directory`);
    const [artifactBytes, worksheetBytes, reviewReceiptRaw] = await Promise.all([
      readRetainedEvidenceFile(join(base, CHAIN_FILES.artifact), `${item.id} retained artifact`, {
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.artifact,
      }),
      readRetainedEvidenceFile(join(base, CHAIN_FILES.worksheet), `${item.id} worksheet`, {
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.worksheet,
      }),
      readRetainedEvidenceFile(join(base, CHAIN_FILES.reviewReceipt), `${item.id} review receipt`, {
        encoding: 'utf8',
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.reviewReceipt,
      }),
    ]);
    await assertRetainedEvidenceDirectoryStable(base, `${item.id} manual evidence directory`, itemDirectoryIdentity);

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
  await assertRetainedEvidenceDirectoryStable(
    manualChainDir,
    'manual release evidence chain directory',
    chainRootIdentity,
  );

  return authorizations;
}
