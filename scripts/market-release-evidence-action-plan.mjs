#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { assessMarketReleaseEvidenceReadiness } from './market-release-evidence-readiness-report.mjs';

const ACTIONS = Object.freeze({
  production_tls_domain: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'Release engineering / platform',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm release:tls-domain:smoke' },
      { phase: 'BIND', command: 'pnpm release:tls-domain:smoke:evidence:bind' },
    ],
  },
  production_deployment_smoke: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'Release engineering / platform',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm release:smoke' },
      { phase: 'BIND', command: 'pnpm release:smoke:evidence:bind' },
    ],
  },
  backup_restore_drill: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'Database / operations',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm db:restore:drill' },
      { phase: 'BIND', command: 'pnpm db:restore:drill:evidence:bind' },
    ],
  },
  external_monitoring_alerting: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'SRE / on-call',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm release:monitoring:smoke' },
      { phase: 'BIND', command: 'pnpm release:monitoring:smoke:evidence:bind' },
    ],
  },
  privacy_terms_legal_review: {
    kind: 'HUMAN_REVIEW_THEN_BIND',
    responsibility: 'Privacy / legal owner',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'HUMAN_REVIEW',
        command: null,
        proofRequirements: [
          'identified accountable privacy/legal reviewer or reviewer role',
          'review timestamp and release/version context',
          'exact retained privacy policy, terms, and consent notice versions reviewed',
          'documented review outcome for privacy, terms, consent, data lifecycle, minors/age-gate, and processors/subprocessors',
          'retained review record without secrets or unrelated personal data',
        ],
      },
      { phase: 'BUILD_ARTIFACT', command: 'pnpm release:privacy-legal:artifact' },
      { phase: 'BIND', command: 'pnpm release:privacy-legal:evidence:bind' },
    ],
  },
  data_export_delete_validation: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'Backend / privacy engineering',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm release:data-lifecycle:smoke' },
      { phase: 'BIND', command: 'pnpm release:data-lifecycle:smoke:evidence:bind' },
    ],
  },
  moderation_support_incident_ops: {
    kind: 'REAL_DRILL_THEN_BIND',
    responsibility: 'Trust & safety / support operations',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'REAL_DRILL',
        command: null,
        proofRequirements: [
          'dated incident or abuse scenario exercised by identified operational roles',
          'moderation, escalation, user-support, and incident-response path actually exercised',
          'response timing and expected-vs-observed outcome recorded',
          'critical gaps, owner, and remediation status recorded',
          'retained drill record without secrets or unnecessary victim/reporter personal data',
        ],
      },
      { phase: 'BUILD_ARTIFACT', command: 'pnpm release:moderation-ops:drill' },
      { phase: 'BIND', command: 'pnpm release:moderation-ops:evidence:bind' },
    ],
  },
  antimalware_provider_validation: {
    kind: 'AUTOMATED_WORKFLOW',
    responsibility: 'Security / platform',
    requiresRealWorldValidation: true,
    steps: [
      { phase: 'VALIDATE', command: 'pnpm release:antimalware:smoke' },
      { phase: 'BIND', command: 'pnpm release:antimalware:smoke:evidence:bind' },
    ],
  },
  ios_physical_validation: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    responsibility: 'Mobile QA on supported physical iOS devices',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'MANUAL_EXTERNAL_VALIDATION',
        command: null,
        proofRequirements: [
          'physical device model and iOS version',
          'KnowMe release version/build and commit under test',
          'dated tester identity or accountable QA role',
          'critical launch flows executed on-device with pass/fail results',
          'crashes, blockers, and material defects recorded with disposition',
          'retained unaltered device-test report or equivalent evidence with stable digest',
        ],
      },
    ],
  },
  android_physical_validation: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    responsibility: 'Mobile QA on supported physical Android devices',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'MANUAL_EXTERNAL_VALIDATION',
        command: null,
        proofRequirements: [
          'physical device manufacturer/model and Android version',
          'KnowMe release version/build and commit under test',
          'dated tester identity or accountable QA role',
          'critical launch flows executed on-device with pass/fail results',
          'crashes, blockers, and material defects recorded with disposition',
          'retained unaltered device-test report or equivalent evidence with stable digest',
        ],
      },
    ],
  },
  ios_store_submission: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    responsibility: 'App Store release owner',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'MANUAL_EXTERNAL_SUBMISSION',
        command: null,
        proofRequirements: [
          'Apple bundle identifier and submitted KnowMe version/build',
          'dated App Store Connect submission/reference identifier',
          'submission or review status captured from the real store workflow',
          'release owner or accountable publishing role identified',
          'retained store submission receipt/export/screenshot with secrets and unrelated account data redacted',
        ],
      },
    ],
  },
  android_store_submission: {
    kind: 'MANUAL_EXTERNAL_EVIDENCE',
    responsibility: 'Google Play release owner',
    requiresRealWorldValidation: true,
    steps: [
      {
        phase: 'MANUAL_EXTERNAL_SUBMISSION',
        command: null,
        proofRequirements: [
          'Android application/package identifier and submitted KnowMe version/build',
          'dated Google Play Console release/submission reference',
          'submission or review status captured from the real store workflow',
          'release owner or accountable publishing role identified',
          'retained store submission receipt/export/screenshot with secrets and unrelated account data redacted',
        ],
      },
    ],
  },
});

function firstExecutableCommand(steps) {
  return steps.find((step) => typeof step.command === 'string')?.command ?? null;
}

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
        command: firstExecutableCommand(action.steps),
      };
    });

  return {
    schemaVersion: 3,
    scope: readiness.scope,
    complete: readiness.complete,
    blockingCount: readiness.blockingCount,
    actions,
    nextAction: actions[0] ?? null,
    proofBoundary:
      'Planning only. Commands validate, prepare or bind evidence but never replace real external, legal, operational, physical-device, or store validation. Manual proof requirements describe minimum retained evidence and do not certify that the validation occurred.',
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
