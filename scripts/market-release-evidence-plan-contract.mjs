#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceManifest } from './market-release-evidence-init.mjs';
import { buildMarketReleaseEvidenceActionPlan } from './market-release-evidence-action-plan.mjs';

const PNPM_ROOT_SCRIPT = /^pnpm ([a-zA-Z0-9:_-]+)$/;

function fullPendingManifest() {
  const result = createMarketReleaseEvidenceManifest({
    scope: 'FULL',
    releaseCommit: '0'.repeat(40),
    releaseVersion: '0.0.0',
    signingKeyId: 'contract-check',
  });
  if (!result.ok) throw new Error(`Could not construct contract-check manifest: ${result.errors.join(' ')}`);
  return result.manifest;
}

export function validateMarketReleaseEvidencePlanCommandContract(packageJson) {
  const scripts = packageJson?.scripts;
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    return { ok: false, errors: ['package.json scripts must be an object.'], commands: [] };
  }

  const plan = buildMarketReleaseEvidenceActionPlan(fullPendingManifest(), {
    now: new Date('2026-08-28T00:00:00.000Z'),
  });
  const errors = [];
  const commands = [];

  for (const action of plan.actions) {
    if (!Array.isArray(action.steps) || action.steps.length === 0) {
      errors.push(`${action.id}: workflow must expose at least one ordered step.`);
      continue;
    }

    for (const step of action.steps) {
      if (step.command === null) continue;
      if (typeof step.command !== 'string') {
        errors.push(`${action.id}/${step.phase}: command must be a string or null.`);
        continue;
      }
      const match = PNPM_ROOT_SCRIPT.exec(step.command);
      if (!match) {
        errors.push(`${action.id}/${step.phase}: unsupported command form ${JSON.stringify(step.command)}.`);
        continue;
      }
      const script = match[1];
      commands.push({ evidenceId: action.id, phase: step.phase, command: step.command, script });
      if (!Object.prototype.hasOwnProperty.call(scripts, script)) {
        errors.push(`${action.id}/${step.phase}: package.json is missing script ${JSON.stringify(script)}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    commands,
  };
}

async function runCli() {
  const packagePath = process.argv[2] ?? 'package.json';
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const result = validateMarketReleaseEvidencePlanCommandContract(packageJson);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  console.log(`Market evidence plan command contract OK (${result.commands.length} executable workflow steps).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Market evidence plan command contract is invalid.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
