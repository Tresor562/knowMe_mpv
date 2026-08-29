import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, symlink, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const releaseCommit = '0123456789abcdef0123456789abcdef01234567';
const releaseVersion = '1.2.3';

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/market-release-evidence-item-create.mjs', ...args], {
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

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-kmd321-'));
  const artifact = join(dir, 'artifact.bin');
  const worksheet = join(dir, 'worksheet.json');
  const receipt = join(dir, 'review-receipt.json');
  const output = join(dir, 'item.json');
  const artifactBytes = Buffer.from('physical-validation-proof\n');
  const worksheetBytes = Buffer.from('{"schemaVersion":1,"kind":"manual-release-evidence-worksheet"}\n');
  const evidenceRef = 'evidence://release/ios_physical_validation.json';
  await writeFile(artifact, artifactBytes);
  await writeFile(worksheet, worksheetBytes);
  await writeFile(receipt, JSON.stringify({
    schemaVersion: 2,
    receiptType: 'MANUAL_RELEASE_EVIDENCE_HUMAN_REVIEW',
    reviewDecision: 'APPROVED_FOR_EVIDENCE_PIPELINE',
    certifiesExternalValidation: false,
    generatedForScope: 'FULL',
    environment: 'PRODUCTION',
    releaseCommit,
    releaseVersion,
    evidenceId: 'ios_physical_validation',
    reviewer: 'release-operator',
    reviewedAt: '2026-08-26T21:20:00.000Z',
    reviewedWorksheet: { sha256: createHash('sha256').update(worksheetBytes).digest('hex') },
    retainedProof: { uri: evidenceRef, sha256: createHash('sha256').update(artifactBytes).digest('hex') },
    validationOccurredAt: '2026-08-26T21:00:00.000Z',
    accountableActorOrRole: 'mobile-qa-lead',
    attestationCount: 5,
  }));
  return { dir, artifact, worksheet, receipt, output, evidenceRef };
}

function argsFor(f) {
  return [
    '--artifact', f.artifact,
    '--worksheet', f.worksheet,
    '--review-receipt', f.receipt,
    '--output', f.output,
    '--id', 'ios_physical_validation',
    '--scope', 'FULL',
    '--verifier', 'release-operator',
    '--ref', f.evidenceRef,
    '--verified-at', '2026-08-26T21:25:00.000Z',
    '--valid-until', '2099-09-02T21:25:00.000Z',
    '--commit', releaseCommit,
    '--version', releaseVersion,
  ];
}

test('manual item creation CLI accepts the reviewed regular-file chain', async () => {
  const f = await fixture();
  try {
    const result = await run(argsFor(f));
    assert.equal(result.code, 0, result.stderr);
    const item = JSON.parse(await readFile(f.output, 'utf8'));
    assert.equal(item.id, 'ios_physical_validation');
    assert.equal(item.releaseCommit, releaseCommit);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test('manual item creation CLI rejects a symlinked retained artifact', async () => {
  const f = await fixture();
  try {
    const target = join(f.dir, 'artifact-target.bin');
    await writeFile(target, 'physical-validation-proof\n');
    await rm(f.artifact);
    await symlink(target, f.artifact);
    const result = await run(argsFor(f));
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /regular non-symlink file|Release evidence item creation failed/);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});
