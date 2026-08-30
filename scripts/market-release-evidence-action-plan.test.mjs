import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { buildMarketReleaseEvidenceActionPlan } from './market-release-evidence-action-plan.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const future = '2099-01-01T00:00:00.000Z';
const cliPath = fileURLToPath(new URL('./market-release-evidence-action-plan.mjs', import.meta.url));

function manifest(scope = 'WEB_V1') {
  return {
    scope,
    evidence: requiredEvidenceForScope(scope).map((id) => ({ id, status: 'PENDING' })),
  };
}

function manifestBytes(scope = 'WEB_V1') {
  return `${JSON.stringify(manifest(scope), null, 2)}\n`;
}

test('WEB_V1 exposes the complete validate or prepare then bind sequence for every blocker', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest(), { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.schemaVersion, 3);
  assert.equal(plan.complete, false);
  assert.equal(plan.actions.length, 8);

  const expected = new Map([
    ['production_tls_domain', ['pnpm release:tls-domain:smoke', 'pnpm release:tls-domain:smoke:evidence:bind']],
    ['production_deployment_smoke', ['pnpm release:smoke', 'pnpm release:smoke:evidence:bind']],
    ['backup_restore_drill', ['pnpm db:restore:drill', 'pnpm db:restore:drill:evidence:bind']],
    ['external_monitoring_alerting', ['pnpm release:monitoring:smoke', 'pnpm release:monitoring:smoke:evidence:bind']],
    ['data_export_delete_validation', ['pnpm release:data-lifecycle:smoke', 'pnpm release:data-lifecycle:smoke:evidence:bind']],
    ['antimalware_provider_validation', ['pnpm release:antimalware:smoke', 'pnpm release:antimalware:smoke:evidence:bind']],
  ]);

  for (const [id, commands] of expected) {
    const action = plan.actions.find((entry) => entry.id === id);
    assert.ok(action);
    assert.deepEqual(
      action.steps.filter((step) => step.command).map((step) => step.command),
      commands,
    );
    assert.equal(action.command, commands[0]);
    assert.equal(action.requiresRealWorldValidation, true);
  }
});

test('privacy/legal cannot start with a binder before documented human review', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest());
  const action = plan.actions.find((entry) => entry.id === 'privacy_terms_legal_review');
  assert.ok(action);
  assert.equal(action.kind, 'HUMAN_REVIEW_THEN_BIND');
  assert.deepEqual(action.steps.map((step) => step.phase), ['HUMAN_REVIEW', 'BUILD_ARTIFACT', 'BIND']);
  assert.equal(action.steps[0].command, null);
  assert.equal(action.steps[0].proofRequirements.length >= 5, true);
  assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('reviewer')), true);
  assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('privacy policy')), true);
  assert.equal(action.steps[1].command, 'pnpm release:privacy-legal:artifact');
  assert.equal(action.steps[2].command, 'pnpm release:privacy-legal:evidence:bind');
  assert.equal(action.command, 'pnpm release:privacy-legal:artifact');
});

test('moderation/support requires retained real-drill proof before artifact construction', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest());
  const action = plan.actions.find((entry) => entry.id === 'moderation_support_incident_ops');
  assert.ok(action);
  assert.equal(action.kind, 'REAL_DRILL_THEN_BIND');
  assert.deepEqual(action.steps.map((step) => step.phase), ['REAL_DRILL', 'BUILD_ARTIFACT', 'BIND']);
  assert.equal(action.steps[0].command, null);
  assert.equal(action.steps[0].proofRequirements.length >= 5, true);
  assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('scenario')), true);
  assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('response timing')), true);
  assert.equal(action.steps[1].command, 'pnpm release:moderation-ops:drill');
  assert.equal(action.steps[2].command, 'pnpm release:moderation-ops:evidence:bind');
  assert.equal(action.command, 'pnpm release:moderation-ops:drill');
});

test('FULL physical-device gates stay manual and require release-bound retained device proof', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest('FULL'));
  const physical = plan.actions.filter((action) => ['ios_physical_validation', 'android_physical_validation'].includes(action.id));
  assert.equal(physical.length, 2);
  for (const action of physical) {
    assert.equal(action.kind, 'MANUAL_EXTERNAL_EVIDENCE');
    assert.equal(action.command, null);
    assert.equal(action.steps.length, 1);
    assert.equal(action.steps[0].command, null);
    assert.equal(action.steps[0].proofRequirements.length >= 6, true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('release version/build and commit')), true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('physical device')), true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('stable digest')), true);
  }
});

test('FULL store gates stay manual and require real submission identifiers/status evidence', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest('FULL'));
  const store = plan.actions.filter((action) => ['ios_store_submission', 'android_store_submission'].includes(action.id));
  assert.equal(store.length, 2);
  for (const action of store) {
    assert.equal(action.kind, 'MANUAL_EXTERNAL_EVIDENCE');
    assert.equal(action.command, null);
    assert.equal(action.steps.length, 1);
    assert.equal(action.steps[0].command, null);
    assert.equal(action.steps[0].proofRequirements.length >= 5, true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('submission')), true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('status')), true);
    assert.equal(action.steps[0].proofRequirements.some((entry) => entry.includes('redacted')), true);
  }
});

test('FULL identifies exactly four physical-device/store gates as manual external work', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest('FULL'));
  const manual = plan.actions.filter((action) => action.kind === 'MANUAL_EXTERNAL_EVIDENCE');
  assert.deepEqual(
    manual.map((action) => action.id),
    ['ios_physical_validation', 'android_physical_validation', 'ios_store_submission', 'android_store_submission'],
  );
  assert.equal(manual.every((action) => action.command === null), true);
  assert.equal(manual.every((action) => action.steps.every((step) => step.command === null)), true);
});

test('verified evidence is removed from the action list without weakening readiness semantics', () => {
  const value = manifest();
  value.evidence[0] = {
    ...value.evidence[0],
    status: 'VERIFIED',
    validUntil: future,
  };
  const plan = buildMarketReleaseEvidenceActionPlan(value, { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.actions.some((action) => action.id === value.evidence[0].id), false);
  assert.equal(plan.blockingCount, 7);
});

test('expired verified evidence becomes actionable again', () => {
  const value = manifest();
  value.evidence[0] = {
    ...value.evidence[0],
    status: 'VERIFIED',
    validUntil: '2026-01-01T00:00:00.000Z',
  };
  const plan = buildMarketReleaseEvidenceActionPlan(value, { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.actions[0].id, value.evidence[0].id);
  assert.equal(plan.actions[0].state, 'EXPIRED');
});

test('complete manifest produces no next action', () => {
  const value = manifest();
  value.evidence = value.evidence.map((item) => ({ ...item, status: 'VERIFIED', validUntil: future }));
  const plan = buildMarketReleaseEvidenceActionPlan(value, { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.complete, true);
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.nextAction, null);
});

test('CLI reads a regular bounded retained manifest and emits the action plan', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowme-action-plan-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    await writeFile(manifestPath, manifestBytes());

    const result = spawnSync(process.execPath, [cliPath, '--file', manifestPath], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.scope, 'WEB_V1');
    assert.equal(plan.complete, false);
    assert.equal(plan.blockingCount, 8);
    assert.equal(plan.actions.length, 8);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a symlinked retained manifest before JSON ingestion', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.');
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'knowme-action-plan-symlink-'));
  try {
    const targetPath = join(dir, 'manifest-target.json');
    const manifestPath = join(dir, 'manifest-link.json');
    await writeFile(targetPath, manifestBytes());
    await symlink(targetPath, manifestPath);

    const result = spawnSync(process.execPath, [cliPath, '--file', manifestPath], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /regular non-symlink file/);
    assert.equal(result.stdout, '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
