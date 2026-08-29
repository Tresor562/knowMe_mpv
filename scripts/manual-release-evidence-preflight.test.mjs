import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createManualReleaseEvidenceTemplate } from './manual-release-evidence-template.mjs';
import { preflightManualReleaseEvidenceWorksheet } from './manual-release-evidence-preflight.mjs';

const COMMIT = 'b'.repeat(40);
const VERSION = '2.0.0';
const NOW = new Date('2026-08-28T12:00:00.000Z');

function completedWorksheet() {
  const { template } = createManualReleaseEvidenceTemplate({ releaseCommit: COMMIT, releaseVersion: VERSION });
  return {
    ...template,
    evidence: template.evidence.map((entry, entryIndex) => ({
      ...entry,
      status: 'COMPLETED_MANUAL_VALIDATION',
      validation: {
        occurredAt: '2026-08-28T11:00:00.000Z',
        accountableActorOrRole: entry.id.includes('store') ? 'Release Manager' : 'Mobile QA Lead',
        outcome: entry.id.includes('store') ? 'SUBMITTED' : 'PASS',
        notes: 'Retained proof reviewed before evidence-item creation.',
      },
      retainedProof: {
        uri: `evidence://knowme-release/${entry.id}`,
        sha256: String(entryIndex + 1).padStart(64, '0'),
      },
      attestations: entry.attestations.map((attestation, index) => ({
        ...attestation,
        satisfied: true,
        reference: `retained-proof section ${index + 1}`,
      })),
    })),
  };
}

function runCli(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/manual-release-evidence-preflight.mjs', '--file', file], {
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
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd330-'));
  const file = join(dir, 'worksheet.json');
  await writeFile(file, `${JSON.stringify(completedWorksheet(), null, 2)}\n`, 'utf8');
  return { dir, file };
}

test('accepts a complete release-bound worksheet without certifying it', () => {
  const worksheet = completedWorksheet();
  const result = preflightManualReleaseEvidenceWorksheet(worksheet, { now: NOW });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.summary.releaseCommit, COMMIT);
  assert.equal(result.summary.releaseVersion, VERSION);
  assert.equal(result.summary.requiredEntries, 4);
  assert.equal(result.summary.completedEntries, 4);
  assert.equal(result.summary.certifiesValidation, false);
  assert.equal(worksheet.certifiesValidation, false);
});

test('fails closed while any manual validation is still pending', () => {
  const worksheet = completedWorksheet();
  worksheet.evidence[0].status = 'PENDING_MANUAL_VALIDATION';
  const result = preflightManualReleaseEvidenceWorksheet(worksheet, { now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /COMPLETED_MANUAL_VALIDATION/);
});

test('fails closed on missing, duplicate, or non-canonical manual evidence ids', () => {
  const missing = completedWorksheet();
  missing.evidence.pop();
  assert.equal(preflightManualReleaseEvidenceWorksheet(missing, { now: NOW }).ok, false);

  const duplicate = completedWorksheet();
  duplicate.evidence[3] = structuredClone(duplicate.evidence[0]);
  assert.match(preflightManualReleaseEvidenceWorksheet(duplicate, { now: NOW }).errors.join(' '), /duplicate|missing/i);

  const unknown = completedWorksheet();
  unknown.evidence[0].id = 'ios_simulator_validation';
  assert.match(preflightManualReleaseEvidenceWorksheet(unknown, { now: NOW }).errors.join(' '), /canonical manual FULL-release ids/i);
});

test('requires canonical retained proof and every canonical attestation', () => {
  const worksheet = completedWorksheet();
  worksheet.evidence[0].retainedProof.uri = 'https://user:secret@example.com/proof';
  worksheet.evidence[1].retainedProof.sha256 = 'ABC';
  worksheet.evidence[2].attestations[0].satisfied = false;
  worksheet.evidence[3].attestations[0].requirement = 'weakened requirement';

  const result = preflightManualReleaseEvidenceWorksheet(worksheet, { now: NOW });
  assert.equal(result.ok, false);
  const errors = result.errors.join(' ');
  assert.match(errors, /credential-free HTTPS or evidence URI/);
  assert.match(errors, /lowercase SHA-256/);
  assert.match(errors, /explicitly satisfied/);
  assert.match(errors, /requirement must remain canonical/);
});

test('rejects future validation timestamps and mutated proof-boundary metadata', () => {
  const worksheet = completedWorksheet();
  worksheet.evidence[0].validation.occurredAt = '2026-08-29T11:00:00.000Z';
  worksheet.templateOnly = false;
  worksheet.certifiesValidation = true;

  const result = preflightManualReleaseEvidenceWorksheet(worksheet, { now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /templateOnly|certifiesValidation|future/);
});

test('rejects release metadata that cannot reproduce the canonical KMD-305 template', () => {
  const worksheet = completedWorksheet();
  worksheet.releaseVersion = 'v2.0.0';
  const result = preflightManualReleaseEvidenceWorksheet(worksheet, { now: NOW });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /releaseVersion/);
});

test('manual evidence preflight CLI accepts a regular bounded worksheet', async () => {
  const fixture = await cliFixture();
  try {
    const result = await runCli(fixture.file);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /preflight passed/i);
    assert.match(result.stdout, /Validated 4\/4 completed worksheet entries/);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('manual evidence preflight CLI rejects a symlinked worksheet before JSON ingestion', async () => {
  const fixture = await cliFixture();
  try {
    const target = join(fixture.dir, 'worksheet-target.json');
    await writeFile(target, `${JSON.stringify(completedWorksheet(), null, 2)}\n`, 'utf8');
    await rm(fixture.file);
    await symlink(target, fixture.file);
    const result = await runCli(fixture.file);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /regular non-symlink file|worksheet preflight failed/i);
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
