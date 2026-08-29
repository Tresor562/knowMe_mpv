import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createManualReleaseEvidenceTemplate } from './manual-release-evidence-template.mjs';
import { createManualEvidenceReviewReceipt } from './manual-release-evidence-review-receipt.mjs';

const RELEASE_COMMIT = 'a'.repeat(40);
const RELEASE_VERSION = '1.0.0';
const NOW = new Date('2026-08-28T12:00:00.000Z');
const OCCURRED_AT = '2026-08-28T11:00:00.000Z';
const REVIEWED_AT = '2026-08-28T11:30:00.000Z';
const ARTIFACT = Buffer.from('retained manual validation proof\n');
const SHA = createHash('sha256').update(ARTIFACT).digest('hex');

function completedWorksheet() {
  const result = createManualReleaseEvidenceTemplate({
    releaseCommit: RELEASE_COMMIT,
    releaseVersion: RELEASE_VERSION,
  });
  assert.equal(result.ok, true);
  const worksheet = structuredClone(result.template);
  for (const entry of worksheet.evidence) {
    entry.status = 'COMPLETED_MANUAL_VALIDATION';
    entry.validation.occurredAt = OCCURRED_AT;
    entry.validation.accountableActorOrRole = 'Release QA';
    entry.validation.outcome = 'PASS';
    entry.validation.notes = 'Retained proof reviewed for release preparation.';
    entry.retainedProof.uri = `evidence://manual/${entry.id}`;
    entry.retainedProof.sha256 = SHA;
    for (const [index, attestation] of entry.attestations.entries()) {
      attestation.satisfied = true;
      attestation.reference = `retained-proof-section-${index + 1}`;
    }
  }
  return worksheet;
}

function exactWorksheetBytes(worksheet) {
  return Buffer.from(`${JSON.stringify(worksheet, null, 2)}\n`, 'utf8');
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/manual-release-evidence-review-receipt.mjs', ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function cliFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd328-'));
  const worksheet = join(dir, 'worksheet.json');
  const artifact = join(dir, 'artifact.bin');
  const output = join(dir, 'review-receipt.json');
  await writeFile(worksheet, exactWorksheetBytes(completedWorksheet()));
  await writeFile(artifact, ARTIFACT);
  return { dir, worksheet, artifact, output };
}

function cliArgs(fixture) {
  return [
    '--worksheet', fixture.worksheet,
    '--artifact', fixture.artifact,
    '--output', fixture.output,
    '--id', 'ios_physical_validation',
    '--reviewer', 'Independent Release Reviewer',
    '--reviewed-at', REVIEWED_AT,
  ];
}

test('creates a release-bound review receipt only after worksheet preflight and exact worksheet/artifact digest match', () => {
  const worksheet = completedWorksheet();
  const worksheetBytes = exactWorksheetBytes(worksheet);
  const result = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'ios_physical_validation',
    reviewer: 'Independent Release Reviewer',
    reviewedAt: REVIEWED_AT,
    worksheetBytes,
    now: NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.receipt.schemaVersion, 2);
  assert.equal(result.receipt.receiptType, 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW');
  assert.equal(result.receipt.reviewDecision, 'APPROVED_FOR_EVIDENCE_PIPELINE');
  assert.equal(result.receipt.certifiesExternalValidation, false);
  assert.equal(result.receipt.releaseCommit, RELEASE_COMMIT);
  assert.equal(result.receipt.releaseVersion, RELEASE_VERSION);
  assert.equal(result.receipt.evidenceId, 'ios_physical_validation');
  assert.equal(result.receipt.retainedProof.sha256, SHA);
  assert.equal(
    result.receipt.reviewedWorksheet.sha256,
    createHash('sha256').update(worksheetBytes).digest('hex'),
  );
  assert.equal(result.receipt.reviewer, 'Independent Release Reviewer');
  assert.ok(result.receipt.attestationCount > 0);
});

test('rejects artifact bytes that do not match retained proof digest', () => {
  const worksheet = completedWorksheet();
  const result = createManualEvidenceReviewReceipt(worksheet, Buffer.from('different'), {
    id: 'android_physical_validation',
    reviewer: 'Release Reviewer',
    reviewedAt: REVIEWED_AT,
    worksheetBytes: exactWorksheetBytes(worksheet),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /artifact SHA-256 does not match/);
});

test('rejects worksheet bytes that do not decode to the preflighted worksheet', () => {
  const worksheet = completedWorksheet();
  const changed = structuredClone(worksheet);
  changed.evidence[0].validation.notes = 'Changed after review preparation.';
  const result = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'ios_physical_validation',
    reviewer: 'Release Reviewer',
    reviewedAt: REVIEWED_AT,
    worksheetBytes: exactWorksheetBytes(changed),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /exact worksheet object/);
});

test('rejects worksheets that have not passed the manual evidence preflight', () => {
  const worksheet = completedWorksheet();
  worksheet.evidence[0].attestations[0].satisfied = false;
  const result = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'ios_physical_validation',
    reviewer: 'Release Reviewer',
    reviewedAt: REVIEWED_AT,
    worksheetBytes: exactWorksheetBytes(worksheet),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /worksheet:/);
});

test('rejects unknown evidence ids, non-canonical reviewers, and future review timestamps', () => {
  const worksheet = completedWorksheet();
  const worksheetBytes = exactWorksheetBytes(worksheet);
  const unknown = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'production_tls_domain',
    reviewer: 'Release Reviewer',
    reviewedAt: REVIEWED_AT,
    worksheetBytes,
    now: NOW,
  });
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join(' '), /canonical manual FULL-release evidence ids/);

  const reviewer = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'ios_store_submission',
    reviewer: ' reviewer ',
    reviewedAt: REVIEWED_AT,
    worksheetBytes,
    now: NOW,
  });
  assert.equal(reviewer.ok, false);
  assert.match(reviewer.errors.join(' '), /reviewer must be canonical/);

  const future = createManualEvidenceReviewReceipt(worksheet, ARTIFACT, {
    id: 'android_store_submission',
    reviewer: 'Release Reviewer',
    reviewedAt: '2026-08-28T13:00:00.000Z',
    worksheetBytes,
    now: NOW,
  });
  assert.equal(future.ok, false);
  assert.match(future.errors.join(' '), /reviewedAt must not be in the future/);
});

test('manual review receipt CLI accepts a regular bounded worksheet and artifact', async () => {
  const fixture = await cliFixture();
  try {
    const result = await runCli(cliArgs(fixture));
    assert.equal(result.code, 0, result.stderr);
    const receipt = JSON.parse(await readFile(fixture.output, 'utf8'));
    assert.equal(receipt.evidenceId, 'ios_physical_validation');
    assert.equal(receipt.retainedProof.sha256, SHA);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('manual review receipt CLI rejects a symlinked worksheet before JSON ingestion', async () => {
  const fixture = await cliFixture();
  try {
    const target = join(fixture.dir, 'worksheet-target.json');
    await writeFile(target, exactWorksheetBytes(completedWorksheet()));
    await rm(fixture.worksheet);
    await symlink(target, fixture.worksheet);
    const result = await runCli(cliArgs(fixture));
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /regular non-symlink file|review receipt creation failed/i);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
