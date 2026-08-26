#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import {
  computeMarketReleaseEvidenceHmac,
  validateMarketReleaseEvidence,
} from './market-release-evidence-preflight.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SIGNING_KEY_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MIN_SIGNING_KEY_LENGTH = 32;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalReleaseVersion(value) {
  return typeof value === 'string' && value === value.trim() && RELEASE_VERSION.test(value) ? value : null;
}

function canonicalSigningKeyId(value) {
  return typeof value === 'string' && value === value.trim() && SIGNING_KEY_ID.test(value) ? value : null;
}

function validSigningKey(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= MIN_SIGNING_KEY_LENGTH;
}

export function signMarketReleaseEvidence(
  manifest,
  { expectedCommit, expectedReleaseVersion, expectedSigningKeyId, signingKey, now = new Date() } = {},
) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Release evidence manifest must be a JSON object.');
  }
  if (!nonEmpty(expectedCommit) || !SHA40.test(expectedCommit.trim())) {
    throw new Error('Expected release commit must be an explicit lowercase 40-character Git commit SHA.');
  }
  if (canonicalReleaseVersion(expectedReleaseVersion) === null) {
    throw new Error('Expected release version must be an explicit canonical SemVer version.');
  }
  if (canonicalSigningKeyId(expectedSigningKeyId) === null) {
    throw new Error('Expected signing key id must be an explicit canonical lowercase identifier.');
  }
  if (!validSigningKey(signingKey)) {
    throw new Error(`Release evidence signing key must be at least ${MIN_SIGNING_KEY_LENGTH} canonical characters.`);
  }

  const candidate = structuredClone(manifest);
  candidate.manifestHmacSha256 = computeMarketReleaseEvidenceHmac(candidate, signingKey);

  const validation = validateMarketReleaseEvidence(candidate, {
    expectedCommit: expectedCommit.trim(),
    expectedReleaseVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!validation.ok) {
    throw new Error(`Refusing to sign invalid or incomplete market evidence:\n${validation.errors.join('\n')}`);
  }

  return candidate;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const inputFile = readArg('--file') ?? process.env.KNOWME_RELEASE_EVIDENCE_FILE;
  const outputFile = readArg('--out');
  if (!nonEmpty(inputFile)) throw new Error('Provide --file <manifest.json> or KNOWME_RELEASE_EVIDENCE_FILE.');
  if (!nonEmpty(outputFile)) throw new Error('Provide --out <signed-manifest.json>. The signer never overwrites the source file.');

  const expectedCommit = readArg('--commit') ?? process.env.GITHUB_SHA ?? process.env.KNOWME_RELEASE_COMMIT;
  const expectedReleaseVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;

  const raw = await readFile(inputFile, 'utf8');
  const manifest = JSON.parse(raw);
  const signed = signMarketReleaseEvidence(manifest, {
    expectedCommit,
    expectedReleaseVersion,
    expectedSigningKeyId,
    signingKey,
  });

  await writeFile(outputFile, `${JSON.stringify(signed, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(
    `Signed market release evidence for ${signed.scope} ${signed.releaseVersion} at ${signed.releaseCommit} using key ${signed.signingKeyId}.`,
  );
  console.log(`Wrote signed manifest to ${outputFile}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release evidence signing failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
