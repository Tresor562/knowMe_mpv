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

export const MANUAL_RELEASE_EVIDENCE_FILE_LIMITS = Object.freeze({
  artifact: 256 * 1024 * 1024,
  worksheet: 2 * 1024 * 1024,
  reviewReceipt: 1024 * 1024,
});

const READ_CHUNK_BYTES = 64 * 1024;

const CHAIN_FILES = Object.freeze({
  artifact: 'artifact',
  worksheet: 'worksheet.json',
  reviewReceipt: 'review-receipt.json',
});

function sameFileIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

async function readBounded(handle, maxBytes, encoding) {
  const chunks = [];
  let total = 0;
  while (true) {
    const chunk = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
    if (bytesRead === 0) break;
    if (total + bytesRead > maxBytes) {
      throw new Error(`file exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
    }
    chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
    total += bytesRead;
  }
  const bytes = Buffer.concat(chunks, total);
  return encoding ? bytes.toString(encoding) : bytes;
}

async function readRegularFile(path, label, { encoding, maxBytes } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`${label} has an invalid retained evidence size limit.`);
  }

  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }
  if (before.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
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
    if (opened.size > BigInt(maxBytes)) {
      throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
    }

    let bytes;
    try {
      bytes = await readBounded(handle, maxBytes, encoding);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('file exceeds')) {
        throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
      }
      throw error;
    }

    const after = await lstat(path, { bigint: true });
    if (!after.isFile() || after.isSymbolicLink() || !sameFileIdentity(opened, after)) {
      throw new Error(`${label} changed while being read; refusing release evidence.`);
    }
    if (after.size > BigInt(maxBytes)) {
      throw new Error(`${label} exceeds the maximum retained evidence size of ${maxBytes} bytes.`);
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
      readRegularFile(join(base, CHAIN_FILES.artifact), `${item.id} retained artifact`, {
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.artifact,
      }),
      readRegularFile(join(base, CHAIN_FILES.worksheet), `${item.id} worksheet`, {
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.worksheet,
      }),
      readRegularFile(join(base, CHAIN_FILES.reviewReceipt), `${item.id} review receipt`, {
        encoding: 'utf8',
        maxBytes: MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.reviewReceipt,
      }),
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
