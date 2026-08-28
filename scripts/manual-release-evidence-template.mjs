#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { createMarketReleaseEvidenceManifest } from './market-release-evidence-init.mjs';
import { buildMarketReleaseEvidenceActionPlan } from './market-release-evidence-action-plan.mjs';

const TEMPLATE_SIGNING_KEY_ID = 'manual-template';

export function createManualReleaseEvidenceTemplate({ releaseCommit, releaseVersion } = {}) {
  const manifestResult = createMarketReleaseEvidenceManifest({
    scope: 'FULL',
    releaseCommit,
    releaseVersion,
    signingKeyId: TEMPLATE_SIGNING_KEY_ID,
  });
  if (!manifestResult.ok) return manifestResult;

  const plan = buildMarketReleaseEvidenceActionPlan(manifestResult.manifest);
  const manualActions = plan.actions.filter((action) => action.kind === 'MANUAL_EXTERNAL_EVIDENCE');

  if (manualActions.length === 0) {
    return { ok: false, errors: ['No manual external evidence requirements are defined for FULL releases.'] };
  }

  return {
    ok: true,
    template: {
      schemaVersion: 1,
      templateOnly: true,
      certifiesValidation: false,
      environment: 'PRODUCTION',
      releaseCommit,
      releaseVersion,
      generatedForScope: 'FULL',
      evidence: manualActions.map((action) => {
        const step = action.steps.find((candidate) => candidate.command === null);
        const requirements = Array.isArray(step?.proofRequirements) ? step.proofRequirements : [];
        if (requirements.length === 0) {
          throw new Error(`Manual evidence action ${action.id} has no retained-proof requirements.`);
        }

        return {
          id: action.id,
          status: 'PENDING_MANUAL_VALIDATION',
          responsibility: action.responsibility,
          validation: {
            occurredAt: null,
            accountableActorOrRole: null,
            outcome: null,
            notes: null,
          },
          retainedProof: {
            uri: null,
            sha256: null,
          },
          attestations: requirements.map((requirement) => ({
            requirement,
            satisfied: null,
            reference: null,
          })),
        };
      }),
      proofBoundary:
        'Template only. Filling this file does not create, verify, bind, sign, or certify release evidence. Physical-device validation and store submission must actually occur and their retained proof must be reviewed before dedicated evidence binding/finalization.',
    },
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const releaseCommit = readArg('--commit') ?? process.env.KNOWME_RELEASE_COMMIT ?? process.env.GITHUB_SHA;
  const releaseVersion = readArg('--version') ?? process.env.KNOWME_RELEASE_VERSION;
  const output = readArg('--output');
  if (!output) throw new Error('Provide --output <manual-evidence-template.json>.');

  const result = createManualReleaseEvidenceTemplate({ releaseCommit, releaseVersion });
  if (!result.ok) throw new Error(result.errors.join(' '));

  await writeFile(output, `${JSON.stringify(result.template, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });

  console.log(`Created release-bound manual evidence template at ${output}.`);
  console.log('This template certifies nothing. Keep every entry pending until the real device/store work and retained-proof review have occurred.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Could not create manual release evidence template.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
