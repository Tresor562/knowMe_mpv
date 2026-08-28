#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SIGNING_KEY_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ZERO_HMAC = '0'.repeat(64);
const SCOPES = new Set(['WEB_V1', 'FULL']);

function canonicalString(value) {
  return typeof value === 'string' && value === value.trim() && value.length > 0 ? value : null;
}

export function createMarketReleaseEvidenceManifest({ scope, releaseCommit, releaseVersion, signingKeyId } = {}) {
  const errors = [];
  if (!SCOPES.has(scope)) errors.push('scope must be WEB_V1 or FULL.');
  if (!SHA40.test(releaseCommit ?? '')) errors.push('releaseCommit must be a lowercase 40-character Git commit SHA.');
  if (!RELEASE_VERSION.test(releaseVersion ?? '')) {
    errors.push('releaseVersion must be a canonical SemVer version without build metadata.');
  }
  const normalizedSigningKeyId = canonicalString(signingKeyId);
  if (normalizedSigningKeyId === null || !SIGNING_KEY_ID.test(normalizedSigningKeyId)) {
    errors.push('signingKeyId must be a canonical lowercase identifier of at most 64 characters.');
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    manifest: {
      schemaVersion: 4,
      scope,
      environment: 'PRODUCTION',
      releaseCommit,
      releaseVersion,
      signingKeyId: normalizedSigningKeyId,
      evidence: requiredEvidenceForScope(scope).map((id) => ({ id, status: 'PENDING' })),
      manifestHmacSha256: ZERO_HMAC,
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const scope = readArg('--scope');
  const releaseCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const releaseVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const signingKeyId = readArg('--signing-key-id') ?? process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const output = readArg('--output');
  if (!output) throw new Error('Provide --output <manifest.json>.');

  const result = createMarketReleaseEvidenceManifest({ scope, releaseCommit, releaseVersion, signingKeyId });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(output, `${JSON.stringify(result.manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Created unsigned ${scope} market release evidence manifest at ${output}.`);
  console.log('All evidence slots are PENDING. Use the dedicated semantic binders before finalization and check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Could not initialize market release evidence manifest.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
