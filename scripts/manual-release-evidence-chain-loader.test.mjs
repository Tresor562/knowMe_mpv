import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGenericMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import {
  loadManualReleaseEvidenceAuthorizations,
  MANUAL_RELEASE_EVIDENCE_FILE_LIMITS,
} from './manual-release-evidence-chain-loader.mjs';
import { validateManualReleaseEvidencePromotionAuthorization } from './manual-release-evidence-promotion-preflight.mjs';

const now = new Date('2026-08-29T00:30:00.000Z');
const artifactBytes = Buffer.from('retained-ios-proof\n');
const worksheetBytes = Buffer.from('{"kind":"manual-release-evidence-worksheet"}\n');
const expectedCommit = 'a'.repeat(40);
const expectedVersion = '1.0.0-rc.2';
const id = 'ios_physical_validation';
const evidenceRef = `evidence://release/${id}.json`;

function reviewReceipt() {
  return {
    schemaVersion: 2,
    receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
    reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
    certifiesExternalValidation: false,
    generatedForScope: 'FULL',
    environment: 'PRODUCTION',
    releaseCommit: expectedCommit,
    releaseVersion: expectedVersion,
    evidenceId: id,
    reviewer: 'mobile-qa-lead',
    reviewedAt: '2026-08-29T00:15:00.000Z',
    reviewedWorksheet: { sha256: createHash('sha256').update(worksheetBytes).digest('hex') },
    retainedProof: { uri: evidenceRef, sha256: createHash('sha256').update(artifactBytes).digest('hex') },
    validationOccurredAt: '2026-08-29T00:10:00.000Z',
    accountableActorOrRole: 'mobile-qa-lead',
    attestationCount: 5,
  };
}

function createItem() {
  const result = createGenericMarketReleaseEvidenceItem(artifactBytes, {
    id,
    scope: 'FULL',
    verifier: 'mobile-qa-lead',
    evidenceRef,
    verifiedAt: '2026-08-29T00:20:00.000Z',
    validUntil: '2026-09-05T00:20:00.000Z',
    worksheetBytes,
    reviewReceipt: reviewReceipt(),
    expectedCommit,
    expectedVersion,
    now,
  });
  assert.equal(result.ok, true);
  return result.item;
}

async function writeChain(root, overrides = {}) {
  const dir = join(root, id);
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(join(dir, 'artifact'), overrides.artifactBytes ?? artifactBytes),
    writeFile(join(dir, 'worksheet.json'), overrides.worksheetBytes ?? worksheetBytes),
    writeFile(join(dir, 'review-receipt.json'), overrides.reviewReceiptBytes ?? JSON.stringify(overrides.reviewReceipt ?? reviewReceipt())),
  ]);
}

test('loads a reviewed retained chain and returns the authentic process-local authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd318-'));
  const item = createItem();
  await writeChain(root);
  const authorizations = await loadManualReleaseEvidenceAuthorizations([item], root, { expectedCommit, expectedVersion, now });
  const authorization = authorizations.get(id);
  assert.ok(authorization);
  assert.equal(validateManualReleaseEvidencePromotionAuthorization(authorization, item, { expectedCommit, expectedVersion }).ok, true);
});

test('fails closed when retained proof bytes drift after human review', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd318-'));
  const item = createItem();
  await writeChain(root, { artifactBytes: Buffer.from('tampered-proof\n') });
  await assert.rejects(
    loadManualReleaseEvidenceAuthorizations([item], root, { expectedCommit, expectedVersion, now }),
    /ios_physical_validation/,
  );
});

test('rejects a retained artifact replaced by a symbolic link', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Creating symlinks requires platform privileges that are not guaranteed on Windows CI.');
    return;
  }
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd318-'));
  const item = createItem();
  await writeChain(root);
  const external = join(root, 'external-proof');
  await writeFile(external, artifactBytes);
  const artifactPath = join(root, id, 'artifact');
  await rm(artifactPath);
  await symlink(external, artifactPath);
  await assert.rejects(
    loadManualReleaseEvidenceAuthorizations([item], root, { expectedCommit, expectedVersion, now }),
    /regular non-symlink file/,
  );
});

test('rejects a symlinked manual release evidence chain root before retained file reads', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Creating directory symlinks requires platform privileges that are not guaranteed on Windows CI.');
    return;
  }
  const parent = await mkdtemp(join(tmpdir(), 'knowme-kmd344-root-'));
  try {
    const realRoot = join(parent, 'real-chain');
    const linkedRoot = join(parent, 'chain-link');
    await mkdir(realRoot);
    await writeChain(realRoot);
    await symlink(realRoot, linkedRoot, 'dir');
    await assert.rejects(
      loadManualReleaseEvidenceAuthorizations([createItem()], linkedRoot, { expectedCommit, expectedVersion, now }),
      /manual release evidence chain directory.*symlink|real directory/i,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('rejects a symlinked per-evidence manual chain directory before retained file reads', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Creating directory symlinks requires platform privileges that are not guaranteed on Windows CI.');
    return;
  }
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd344-item-'));
  const externalRoot = await mkdtemp(join(tmpdir(), 'knowme-kmd344-external-'));
  try {
    await writeChain(externalRoot);
    await symlink(join(externalRoot, id), join(root, id), 'dir');
    await assert.rejects(
      loadManualReleaseEvidenceAuthorizations([createItem()], root, { expectedCommit, expectedVersion, now }),
      /ios_physical_validation manual evidence directory.*symlink|real directory/i,
    );
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(externalRoot, { recursive: true, force: true }),
    ]);
  }
});

test('rejects oversized retained review metadata before JSON parsing or promotion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowme-kmd318-'));
  const item = createItem();
  await writeChain(root, {
    reviewReceiptBytes: Buffer.alloc(MANUAL_RELEASE_EVIDENCE_FILE_LIMITS.reviewReceipt + 1, 0x20),
  });
  await assert.rejects(
    loadManualReleaseEvidenceAuthorizations([item], root, { expectedCommit, expectedVersion, now }),
    /review receipt exceeds the maximum retained evidence size/,
  );
});

test('requires the retained-chain directory when manual FULL evidence is present', async () => {
  await assert.rejects(
    loadManualReleaseEvidenceAuthorizations([createItem()], undefined, { expectedCommit, expectedVersion, now }),
    /--manual-chain-dir is required/,
  );
});

test('does not require a manual chain for non-manual evidence', async () => {
  const result = await loadManualReleaseEvidenceAuthorizations([{ id: 'backup_restore_drill' }], undefined, {
    expectedCommit,
    expectedVersion,
    now,
  });
  assert.equal(result.size, 0);
});
