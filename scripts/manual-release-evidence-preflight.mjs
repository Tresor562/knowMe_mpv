#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createManualReleaseEvidenceTemplate } from './manual-release-evidence-template.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ALLOWED_PROOF_PROTOCOLS = new Set(['https:', 'evidence:']);
const MAX_TEXT = 2048;

function canonicalText(value, { max = MAX_TEXT } = {}) {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= max && !CONTROL_CHARACTERS.test(value)
    ? value
    : null;
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function canonicalProofUri(value) {
  if (typeof value !== 'string' || value !== value.trim() || CONTROL_CHARACTERS.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (!ALLOWED_PROOF_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname) return null;
    return value;
  } catch {
    return null;
  }
}

export function preflightManualReleaseEvidenceWorksheet(worksheet, { now = new Date() } = {}) {
  const errors = [];
  if (!worksheet || typeof worksheet !== 'object' || Array.isArray(worksheet)) {
    return { ok: false, errors: ['worksheet must be a JSON object.'] };
  }

  if (worksheet.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (worksheet.templateOnly !== true) errors.push('templateOnly must remain true.');
  if (worksheet.certifiesValidation !== false) errors.push('certifiesValidation must remain false.');
  if (worksheet.environment !== 'PRODUCTION') errors.push('environment must be PRODUCTION.');
  if (worksheet.generatedForScope !== 'FULL') errors.push('generatedForScope must be FULL.');

  const expectedResult = createManualReleaseEvidenceTemplate({
    releaseCommit: worksheet.releaseCommit,
    releaseVersion: worksheet.releaseVersion,
  });
  if (!expectedResult.ok) {
    errors.push(...expectedResult.errors);
    return { ok: false, errors };
  }

  const nowMs = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) errors.push('now must be a valid Date.');

  if (!Array.isArray(worksheet.evidence)) {
    errors.push('evidence must be an array.');
    return { ok: false, errors };
  }

  const expectedById = new Map(expectedResult.template.evidence.map((entry) => [entry.id, entry]));
  if (worksheet.evidence.length !== expectedById.size) {
    errors.push(`evidence must contain exactly ${expectedById.size} manual FULL-release entries.`);
  }

  const seen = new Set();
  for (const entry of worksheet.evidence) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push('every evidence entry must be an object.');
      continue;
    }

    if (typeof entry.id !== 'string' || !expectedById.has(entry.id)) {
      errors.push('every evidence id must be one of the canonical manual FULL-release ids.');
      continue;
    }
    if (seen.has(entry.id)) {
      errors.push(`duplicate manual evidence id: ${entry.id}.`);
      continue;
    }
    seen.add(entry.id);

    const expected = expectedById.get(entry.id);
    if (entry.responsibility !== expected.responsibility) {
      errors.push(`${entry.id}: responsibility must remain canonical.`);
    }
    if (entry.status !== 'COMPLETED_MANUAL_VALIDATION') {
      errors.push(`${entry.id}: status must be COMPLETED_MANUAL_VALIDATION before preflight can pass.`);
    }

    const occurredAtMs = canonicalTimestamp(entry.validation?.occurredAt);
    if (occurredAtMs === null) errors.push(`${entry.id}: validation.occurredAt must be a canonical UTC timestamp.`);
    else if (Number.isFinite(nowMs) && occurredAtMs > nowMs + 5 * 60_000) errors.push(`${entry.id}: validation.occurredAt must not be in the future.`);

    if (canonicalText(entry.validation?.accountableActorOrRole, { max: 128 }) === null) {
      errors.push(`${entry.id}: validation.accountableActorOrRole must be canonical and non-empty.`);
    }
    if (canonicalText(entry.validation?.outcome, { max: 128 }) === null) {
      errors.push(`${entry.id}: validation.outcome must be canonical and non-empty.`);
    }
    if (entry.validation?.notes !== null && entry.validation?.notes !== undefined && canonicalText(entry.validation.notes) === null) {
      errors.push(`${entry.id}: validation.notes must be null or canonical non-empty text.`);
    }

    if (canonicalProofUri(entry.retainedProof?.uri) === null) {
      errors.push(`${entry.id}: retainedProof.uri must be a credential-free HTTPS or evidence URI without query or fragment.`);
    }
    if (typeof entry.retainedProof?.sha256 !== 'string' || !SHA256.test(entry.retainedProof.sha256)) {
      errors.push(`${entry.id}: retainedProof.sha256 must be a lowercase SHA-256 digest.`);
    }

    if (!Array.isArray(entry.attestations)) {
      errors.push(`${entry.id}: attestations must be an array.`);
      continue;
    }
    if (entry.attestations.length !== expected.attestations.length) {
      errors.push(`${entry.id}: attestations must exactly match the canonical retained-proof requirements.`);
      continue;
    }

    for (let index = 0; index < expected.attestations.length; index += 1) {
      const actual = entry.attestations[index];
      const canonical = expected.attestations[index];
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
        errors.push(`${entry.id}: attestation ${index + 1} must be an object.`);
        continue;
      }
      if (actual.requirement !== canonical.requirement) {
        errors.push(`${entry.id}: attestation ${index + 1} requirement must remain canonical.`);
      }
      if (actual.satisfied !== true) {
        errors.push(`${entry.id}: attestation ${index + 1} must be explicitly satisfied.`);
      }
      if (canonicalText(actual.reference) === null) {
        errors.push(`${entry.id}: attestation ${index + 1} must retain a non-empty reference.`);
      }
    }
  }

  for (const id of expectedById.keys()) {
    if (!seen.has(id)) errors.push(`missing manual evidence id: ${id}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      releaseCommit: worksheet.releaseCommit,
      releaseVersion: worksheet.releaseVersion,
      requiredEntries: expectedById.size,
      completedEntries: worksheet.evidence.filter((entry) => entry?.status === 'COMPLETED_MANUAL_VALIDATION').length,
      certifiesValidation: false,
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const file = readArg('--file');
  if (!file) throw new Error('Provide --file <completed-manual-evidence-worksheet.json>.');

  const worksheet = JSON.parse(await readFile(file, 'utf8'));
  const result = preflightManualReleaseEvidenceWorksheet(worksheet);
  if (!result.ok) throw new Error(result.errors.join('\n'));

  console.log(`Manual evidence worksheet preflight passed for ${result.summary.releaseVersion} @ ${result.summary.releaseCommit}.`);
  console.log(`Validated ${result.summary.completedEntries}/${result.summary.requiredEntries} completed worksheet entries.`);
  console.log('This preflight certifies nothing. A reviewer must still inspect retained proof, create the dedicated generic evidence items, apply them, sign the manifest, and pass check:market-ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Manual release evidence worksheet preflight failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
