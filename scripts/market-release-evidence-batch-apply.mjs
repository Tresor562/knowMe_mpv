#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyMarketReleaseEvidenceItem } from './market-release-evidence-item-apply.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const ZERO_HMAC = '0'.repeat(64);

export function applyMarketReleaseEvidenceBatch(
  manifest,
  items,
  { expectedCommit, expectedVersion, now = new Date() } = {},
) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest must be a JSON object.'] };
  }
  if (!Array.isArray(items)) return { ok: false, errors: ['items must be an array.'] };
  if (manifest.scope !== 'WEB_V1' && manifest.scope !== 'FULL') {
    return { ok: false, errors: ['manifest scope must be WEB_V1 or FULL.'] };
  }
  if (!Array.isArray(manifest.evidence)) {
    return { ok: false, errors: ['manifest evidence must be an array.'] };
  }
  if (manifest.manifestHmacSha256 !== ZERO_HMAC) {
    return { ok: false, errors: ['manifest must be unsigned before batch apply.'] };
  }

  const allowedIds = requiredEvidenceForScope(manifest.scope);
  const pendingIds = manifest.evidence
    .filter((entry) => entry?.status === 'PENDING')
    .map((entry) => entry?.id);

  const pendingSet = new Set(pendingIds);
  if (pendingSet.size !== pendingIds.length) errors.push('manifest contains duplicate PENDING evidence slots.');
  if (pendingIds.some((id) => typeof id !== 'string' || !allowedIds.includes(id))) {
    errors.push('manifest contains a PENDING evidence slot outside the selected scope.');
  }

  const itemIds = items.map((item) => item?.id);
  const itemSet = new Set(itemIds);
  if (itemSet.size !== itemIds.length) errors.push('items contain duplicate evidence ids.');
  if (itemIds.some((id) => typeof id !== 'string' || !allowedIds.includes(id))) {
    errors.push('items contain an evidence id outside the selected scope.');
  }

  const missing = pendingIds.filter((id) => !itemSet.has(id));
  const unexpected = itemIds.filter((id) => !pendingSet.has(id));
  if (missing.length > 0) errors.push(`missing evidence items for: ${missing.sort().join(', ')}.`);
  if (unexpected.length > 0) errors.push(`unexpected evidence items for non-PENDING slots: ${unexpected.sort().join(', ')}.`);
  if (errors.length > 0) return { ok: false, errors };

  let output = structuredClone(manifest);
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const result = applyMarketReleaseEvidenceItem(output, item, {
      expectedCommit,
      expectedVersion,
      now,
    });
    if (!result.ok) {
      return { ok: false, errors: result.errors.map((error) => `${item.id}: ${error}`) };
    }
    output = result.manifest;
  }

  const remainingPending = output.evidence.filter((entry) => entry?.status === 'PENDING');
  if (remainingPending.length > 0) {
    return { ok: false, errors: ['batch apply must leave no PENDING evidence slots.'] };
  }
  return { ok: true, manifest: output };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const manifestPath = readArg('--manifest');
  const itemsDir = readArg('--items-dir');
  const outputPath = readArg('--output');
  if (!manifestPath || !itemsDir || !outputPath) {
    throw new Error('Provide --manifest <file>, --items-dir <directory>, and --output <file>.');
  }
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entries = (await readdir(itemsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) throw new Error('items directory must contain at least one .json evidence item.');

  const items = [];
  for (const entry of entries) {
    const path = join(itemsDir, entry.name);
    items.push(JSON.parse(await readFile(path, 'utf8')));
  }

  const result = applyMarketReleaseEvidenceBatch(manifest, items, { expectedCommit, expectedVersion });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Applied ${items.length} evidence items atomically to unsigned manifest at ${outputPath}.`);
  console.log('The manifest remains unsigned and must still pass release:evidence:sign and check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Release evidence batch apply failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
