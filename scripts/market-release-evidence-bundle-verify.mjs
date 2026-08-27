#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateMarketReleaseEvidence } from './market-release-evidence-preflight.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function canonicalManifestBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function canonicalArtifactPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTERS.test(value)
  );
}

export function parseMarketReleaseEvidenceDigestRecord(raw, expectedManifestPath) {
  const errors = [];
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, errors: ['Release evidence digest record must be non-empty UTF-8 text.'] };
  }
  if (raw.includes('\r')) {
    errors.push('Release evidence digest record must use canonical LF line endings.');
  }

  const match = /^([0-9a-f]{64})  ([^\r\n]+)\n$/.exec(raw);
  if (!match) {
    errors.push('Release evidence digest record must contain exactly one canonical SHA-256 line.');
    return { ok: false, errors };
  }

  const [, sha256, manifestPath] = match;
  if (!SHA256.test(sha256)) errors.push('Release evidence digest must be a lowercase 64-character SHA-256 value.');
  if (!canonicalArtifactPath(manifestPath)) {
    errors.push('Release evidence digest manifest path must be canonical and free of control characters.');
  }
  if (!canonicalArtifactPath(expectedManifestPath)) {
    errors.push('Expected signed manifest path must be canonical and free of control characters.');
  } else if (manifestPath !== expectedManifestPath) {
    errors.push('Release evidence digest record does not name the signed manifest being verified.');
  }

  return { ok: errors.length === 0, errors, sha256, manifestPath };
}

export function verifyMarketReleaseEvidenceBundle({
  manifestBytes,
  digestText,
  manifestPath,
  expectedCommit,
  expectedVersion,
  expectedSigningKeyId,
  signingKey,
  now = new Date(),
}) {
  const errors = [];
  const digest = parseMarketReleaseEvidenceDigestRecord(digestText, manifestPath);
  if (!digest.ok) errors.push(...digest.errors);

  if (!Buffer.isBuffer(manifestBytes) || manifestBytes.length === 0) {
    errors.push('Signed release evidence manifest must be non-empty bytes.');
    return { ok: false, errors };
  }

  const actualSha256 = createHash('sha256').update(manifestBytes).digest('hex');
  if (digest.ok && actualSha256 !== digest.sha256) {
    errors.push('Signed release evidence manifest SHA-256 does not match its digest record.');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    errors.push('Signed release evidence manifest must be valid UTF-8 JSON.');
    return { ok: false, errors, actualSha256 };
  }

  const canonicalBytes = canonicalManifestBytes(manifest);
  if (!canonicalBytes.equals(manifestBytes)) {
    errors.push('Signed release evidence manifest bytes are not in the canonical finalized JSON representation.');
  }

  const validation = validateMarketReleaseEvidence(manifest, {
    expectedCommit,
    expectedReleaseVersion: expectedVersion,
    expectedSigningKeyId,
    signingKey,
    now,
  });
  if (!validation.ok) errors.push(...validation.errors);

  return {
    ok: errors.length === 0,
    errors,
    manifest,
    sha256: actualSha256,
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const manifestPath = readArg('--manifest');
  const digestPath = readArg('--digest');
  if (!manifestPath || !digestPath) {
    throw new Error('Provide --manifest <signed-manifest.json> and --digest <sha256-file>.');
  }

  const expectedCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const expectedVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const expectedSigningKeyId = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID;
  const signingKey = process.env.KNOWME_RELEASE_EVIDENCE_SIGNING_KEY;

  const [manifestBytes, digestText] = await Promise.all([
    readFile(manifestPath),
    readFile(digestPath, 'utf8'),
  ]);

  const result = verifyMarketReleaseEvidenceBundle({
    manifestBytes,
    digestText,
    manifestPath,
    expectedCommit,
    expectedVersion,
    expectedSigningKeyId,
    signingKey,
  });
  if (!result.ok) throw new Error(result.errors.join(' '));

  console.log(`Verified signed market release evidence bundle for ${result.manifest.scope} ${result.manifest.releaseVersion} at ${result.manifest.releaseCommit}.`);
  console.log(`SHA-256: ${result.sha256}`);
  console.log('This verifies bundle integrity, authenticity, and manifest completeness only; external evidence truthfulness still requires retained real-world proof.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market release evidence bundle verification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
