import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketReleaseEvidenceActionPlan } from './market-release-evidence-action-plan.mjs';
import { requiredEvidenceForScope } from './market-release-evidence-preflight.mjs';

const future = '2099-01-01T00:00:00.000Z';

function manifest(scope = 'WEB_V1') {
  return {
    scope,
    evidence: requiredEvidenceForScope(scope).map((id) => ({ id, status: 'PENDING' })),
  };
}

test('WEB_V1 exposes the complete validate or prepare then bind sequence for every blocker', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest(), { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.schemaVersion, 2);
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

test('privacy/legal cannot start with a binder before human review and artifact construction', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest());
  const action = plan.actions.find((entry) => entry.id === 'privacy_terms_legal_review');
  assert.ok(action);
  assert.equal(action.kind, 'HUMAN_REVIEW_THEN_BIND');
  assert.deepEqual(action.steps, [
    { phase: 'HUMAN_REVIEW', command: null },
    { phase: 'BUILD_ARTIFACT', command: 'pnpm release:privacy-legal:artifact' },
    { phase: 'BIND', command: 'pnpm release:privacy-legal:evidence:bind' },
  ]);
  assert.equal(action.command, 'pnpm release:privacy-legal:artifact');
});

test('moderation/support cannot start with a binder before a real drill and artifact construction', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest());
  const action = plan.actions.find((entry) => entry.id === 'moderation_support_incident_ops');
  assert.ok(action);
  assert.equal(action.kind, 'REAL_DRILL_THEN_BIND');
  assert.deepEqual(action.steps, [
    { phase: 'REAL_DRILL', command: null },
    { phase: 'BUILD_ARTIFACT', command: 'pnpm release:moderation-ops:drill' },
    { phase: 'BIND', command: 'pnpm release:moderation-ops:evidence:bind' },
  ]);
  assert.equal(action.command, 'pnpm release:moderation-ops:drill');
});

test('FULL identifies physical-device and store evidence as manual external work with no executable path', () => {
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
