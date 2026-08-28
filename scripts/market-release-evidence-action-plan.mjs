#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { assessMarketReleaseEvidenceReadiness } from './market-release-evidence-readiness-report.mjs';

const ACTIONS = Object.freeze({
  production_tls_domain: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm release:tls-domain:smoke:evidence:bind',
    responsibility: 'Release engineering / platform',
  },
  production_deployment_smoke: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm release:smoke:evidence:bind',
    responsibility: 'Release engineering / platform',
  },
  backup_restore_drill: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm db:restore:drill:evidence:bind',
    responsibility: 'Database / operations',
  },
  external_monitoring_alerting: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm release:monitoring:smoke:evidence:bind',
    responsibility: 'SRE / on-call',
  },
  privacy_terms_legal_review: {
    kind: 'AUTOMATED_BINDER_AFTER_HUMAN_REVIEW',
    command: 'pnpm release:privacy-legal:evidence:bind',
    responsibility: 'Privacy / legal owner',
  },
  data_export_delete_validation: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm release:data-lifecycle:smoke:evidence:bind',
    responsibility: 'Backend / privacy engineering',
  },
  moderation_support_incident_ops: {
    kind: 'AUTOMATED_BINDER_AFTER_REAL_DRILL',
    command: 'pnpm release:moderation-ops:evidence:bind',
    responsibility: 'Trust & safety / support operations',
  },
  antimalware_provider_validation: {
    kind: 'AUTOMATED_BINDER',
    command: 'pnpm release:antimalware:smoke:evidence:bind',
    responsibility: 'Security / platform',
  },
  ios_physical_validation: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    command: null,
    responsibility: 'Mobile QA on supported physical iOS devices',
  },
  android_physical_validation: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    command: null,
    responsibility: 'Mobile QA on supported physical Android devices',
  },
  ios_store_submission: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    command: null,
    responsibility: 'App Store release owner',
  },
  android_store_submission: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    command: null,
    responsibility: 'Google Play release owner',
  },
});

export function buildMarketReleaseEvidenceActionPlan(manifest, options = {}) {
  const readiness = assessMarketReleaseEvidenceReadiness(manifest, options);
  const actions = readiness.evidence
    .filter((entry) => entry.state !== 'VERIFIED')
    .map((entry) => {
      const action = ACTIONS[entry.id];
      if (!action) throw new Error(`No action mapping exists for required evidence: ${entry.id}`);
      return {
        id: entry.id,
        state: entry.state,
        ...action,
      };
    });

  return {
    schemaVersion: 1,
    scope: readiness.scope,
    complete: readiness.complete,
    blockingCount: readiness.blockingCount,
    actions,
    nextAction: actions[0] ?? null,
    proofBoundary:
      'Planning only. Commands prepare or bind evidence but never replace real external, legal, operational, physical-device, or store validation.',
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const file = readArg('--file') ?? process.env.KNOWME_RELEASE_EVIDENCE_FILE;
  if (typeof file !== 'string' || file.trim().length === 0) {
    throw new Error('Provide --file <manifest.json> or KNOWME_RELEASE_EVIDENCE_FILE.');
  }

  const manifest = JSON.parse(await readFile(file, 'utf8'));
  const plan = buildMarketReleaseEvidenceActionPlan(manifest);
  console.log(JSON.stringify(plan, null, 2));
  if (!plan.complete) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Could not produce market release evidence action plan.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
