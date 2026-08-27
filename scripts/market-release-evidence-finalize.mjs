#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { open, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { applyMarketReleaseEvidenceBatch } from './market-release-evidence-batch-apply.mjs';
import { signMarketReleaseEvidence } from './market-release-evidence-sign.mjs';
import { validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertCanonicalArtifactPath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new Error(`${label} must be a canonical non-empty path without leading/trailing whitespace or control characters.`);
  }
}

export function finalizeMarketReleaseEvidence(
  manifest,
  items,
  {
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now = new Date(),
  } = {},
) {
  const applied = applyMarketReleaseEvidenceBatch(manifest, items, {
    expectedCommit,
    expectedVersion,
    now,
  });
  if (!applied.ok) {
    return { ok: false, errors: applied.errors };
  }

  let signed;
  try {
    signed = signMarketReleaseEvidence(applied.manifest, {
      expectedCommit,
      expectedReleaseVersion: expectedVersion,
      expectedSigningKeyId,
      signingKey,
      now,
    });
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }

  const validation = validateMarketReleaseEvidence(signed, {
    expectedCommit,
    expectedReleaseVersion: expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const bytes = canonicalBytes(signed);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { ok: true, manifest: signed, bytes, sha256 };
}

export async function writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes, sha256 }) {
  assertCanonicalArtifactPath(outputPath, 'Signed manifest output path');
  assertCanonicalArtifactPath(digestPath, 'Digest output path');
  if (outputPath === digestPath) throw new Error('Signed manifest and digest outputs must be different files.');

  let outputHandle;
  let digestHandle;
  let outputReserved = false;
  let digestReserved = false;
  try {
    outputHandle = await open(outputPath, 'wx', 0o600);
    outputReserved = true;
    digestHandle = await open(digestPath, 'wx', 0o600);
    digestReserved = true;

    await outputHandle.writeFile(bytes);
    await digestHandle.writeFile(`${sha256}  ${outputPath}\n`, 'utf8');
  } catch (error) {
    await Promise.allSettled([outputHandle?.close(), digestHandle?.close()]);
    if (outputReserved) await unlink(outputPath).catch(() => undefined);
    if (digestReserved) await unlink(digestPath).catch(() => undefined);
    throw error;
  }

  await Promise.all([outputHandle.close(), digestHandle.close()]);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readItemsDirectory(itemsDir) {
  const entries = (await readdir(itemsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) throw new Error('items directory must contain at least one .json evidence item.');
  const items = [];
  for (const entry of entries) {
    items.push(JSON.parse(await readFile(join(itemsDir, entry.name), 'utf8')));
  }
  return items;
}

async function runCli() {
  const manifestPath = readArg('--manifest');
  const itemsDir = readArg('--items-dir');
  const outputPath = readArg('--output');
  const digestPath = readArg('--digest-output');
  if (!manifestPath || !itemsDir || !outputPath || !digestPath) {
    throw new Error('Provide --manifest <file>, --items-dir <directory>, --output <signed-manifest.json>, and --digest-output <sha256-file>.');
  }

  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const items = await readItemsDirectory(itemsDir);

  const result = finalizeMarketReleaseEvidence(manifest, items, {
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFinalizedMarketReleaseEvidence({ outputPath, digestPath, bytes: result.bytes, sha256: result.sha256 });

  console.log(`Finalized and signed market release evidence at ${outputPath}.`);
  console.log(`SHA-256: ${result.sha256}`);
  console.log(`Digest record: ${digestPath}`);
  console.log('This validates manifest integrity and completeness only; external evidence truthfulness still requires retained real-world proof.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release evidence finalization failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
