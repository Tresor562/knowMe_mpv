#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyMarketReleaseEvidenceItem } from './market-release-evidence-item-apply.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';
import { loadManualReleaseEvidenceAuthorizations } from './manual-release-evidence-chain-loader.mjs';
import { readRetainedEvidenceFile, RETAINED_EVIDENCE_FILE_LIMITS } from './retained-evidence-safe-read.mjs';
import { listStableRetainedEvidenceJsonFiles } from './retained-evidence-safe-directory.mjs';

const ZERO_HMAC = '0'.repeat(64);

export function applyMarketReleaseEvidenceBatch(
  manifest,
  items,
  { expectedCommit, expectedVersion, now = new Date(), manualAuthorizations = new Map() } = {},
) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { ok: false, errors: ['manifest must be a JSON object.'] };
  if (!Array.isArray(items)) return { ok: false, errors: ['items must be an array.'] };
  if (!(manualAuthorizations instanceof Map)) return { ok: false, errors: ['manualAuthorizations must be a Map keyed by evidence id.'] };
  if (manifest.scope !== 'WEB_V1' && manifest.scope !== 'FULL') return { ok: false, errors: ['manifest scope must be WEB_V1 or FULL.'] };
  if (!Array.isArray(manifest.evidence)) return { ok: false, errors: ['manifest evidence must be an array.'] };
  if (manifest.manifestHmacSha256 !== ZERO_HMAC) return { ok: false, errors: ['manifest must be unsigned before batch apply.'] };

  const allowedIds = requiredEvidenceForScope(manifest.scope);
  const manifestIds = manifest.evidence.map((entry) => entry?.id);
  const manifestIdSet = new Set(manifestIds);
  if (manifestIds.length !== allowedIds.length || manifestIdSet.size !== manifestIds.length || manifestIds.some((id) => typeof id !== 'string' || !allowedIds.includes(id)) || allowedIds.some((id) => !manifestIdSet.has(id))) {
    errors.push('manifest must contain exactly one evidence slot for every id required by the selected scope.');
  }

  const pendingIds = manifest.evidence.filter((entry) => entry?.status === 'PENDING').map((entry) => entry?.id);
  const pendingSet = new Set(pendingIds);
  const itemIds = items.map((item) => item?.id);
  const itemSet = new Set(itemIds);
  if (itemSet.size !== itemIds.length) errors.push('items contain duplicate evidence ids.');
  if (itemIds.some((id) => typeof id !== 'string' || !allowedIds.includes(id))) errors.push('items contain an evidence id outside the selected scope.');

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
      manualAuthorization: manualAuthorizations.get(item.id),
    });
    if (!result.ok) return { ok: false, errors: result.errors.map((error) => `${item.id}: ${error}`) };
    output = result.manifest;
  }

  if (output.evidence.some((entry) => entry?.status === 'PENDING')) return { ok: false, errors: ['batch apply must leave no PENDING evidence slots.'] };
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
  if (!manifestPath || !itemsDir || !outputPath) throw new Error('Provide --manifest <file>, --items-dir <directory>, and --output <file>.');
  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const manualChainDir = readArg('--manual-chain-dir');
  const manifest = JSON.parse(await readRetainedEvidenceFile(manifestPath, 'release evidence manifest', {
    encoding: 'utf8',
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.manifest,
  }));
  const entries = await listStableRetainedEvidenceJsonFiles(itemsDir, 'items directory');
  const items = [];
  for (const entry of entries) {
    const itemPath = join(itemsDir, entry.name);
    const bytes = await readRetainedEvidenceFile(itemPath, `release evidence batch item ${entry.name}`, {
      encoding: 'utf8',
      maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.item,
    });
    items.push(JSON.parse(bytes));
  }
  const manualAuthorizations = await loadManualReleaseEvidenceAuthorizations(items, manualChainDir, {
    expectedCommit,
    expectedVersion,
  });
  const result = applyMarketReleaseEvidenceBatch(manifest, items, {
    expectedCommit,
    expectedVersion,
    manualAuthorizations,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));
  await writeFile(outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Applied ${items.length} evidence items atomically to unsigned manifest at ${outputPath}.`);
  console.log('FULL manual evidence was authorized only from retained artifact + worksheet + human-review receipt bytes loaded in this process.');
  console.log('The manifest remains unsigned and must still pass release:evidence:sign and check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Release evidence batch apply failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
