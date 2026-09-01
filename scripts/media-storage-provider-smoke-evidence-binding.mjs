#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceItem } from './market-release-evidence-item-create.mjs';
import { validateObjectStorageProviderSmokeArtifact } from './media-storage-provider-smoke-evidence-preflight.mjs';
import {
  readRetainedEvidenceFile,
  RETAINED_EVIDENCE_FILE_LIMITS,
} from './retained-evidence-safe-read.mjs';

export function createObjectStorageProviderMarketEvidenceItem(artifactBytes, options = {}) {
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(artifactBytes).toString('utf8'));
  } catch {
    return { ok: false, errors: ['Object-storage smoke artifact must contain valid JSON.'] };
  }

  const validation = validateObjectStorageProviderSmokeArtifact(artifact, { now: options.now });
  if (!validation.ok) return validation;

  return createMarketReleaseEvidenceItem(artifactBytes, {
    id: 'object_storage_provider_validation',
    scope: options.scope,
    verifier: options.verifier,
    evidenceRef: options.evidenceRef,
    verifiedAt: validation.verifiedAt,
    validUntil: options.validUntil,
    now: options.now,
  });
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const artifactPath = readArg('--artifact');
  const outputPath = readArg('--output');
  const scope = readArg('--scope');
  const verifier = readArg('--verifier');
  const evidenceRef = readArg('--ref');
  const validUntil = readArg('--valid-until');

  if (!artifactPath || !outputPath || !scope || !verifier || !evidenceRef || !validUntil) {
    throw new Error('Provide --artifact, --output, --scope, --verifier, --ref, and --valid-until.');
  }

  const artifactBytes = await readRetainedEvidenceFile(artifactPath, 'object-storage provider retained artifact', {
    maxBytes: RETAINED_EVIDENCE_FILE_LIMITS.artifact,
  });
  const result = createObjectStorageProviderMarketEvidenceItem(artifactBytes, {
    scope,
    verifier,
    evidenceRef,
    validUntil,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(outputPath, `${JSON.stringify(result.item, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created VERIFIED object_storage_provider_validation evidence item at ${outputPath}.`);
  console.log(`SHA-256: ${result.item.evidenceSha256}`);
  console.log('This item still must be applied to the unsigned release manifest, signed, bundled, retained, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Object-storage provider smoke evidence binding failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
