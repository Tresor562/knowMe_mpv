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

test('WEB_V1 maps every blocker to the dedicated semantic path', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest(), { now: new Date('2026-08-28T00:00:00.000Z') });
  assert.equal(plan.complete, false);
  assert.equal(plan.actions.length, 8);
  assert.equal(plan.actions.every((action) => action.kind !== 'MANUAL_EXTERNAL_EVIDENCE'), true);
  assert.equal(plan.actions.some((action) => action.command === 'pnpm release:privacy-legal:evidence:bind'), true);
  assert.equal(plan.actions.some((action) => action.command === 'pnpm release:moderation-ops:evidence:bind'), true);
});

test('FULL identifies physical-device and store evidence as manual external work', () => {
  const plan = buildMarketReleaseEvidenceActionPlan(manifest('FULL'));
  const manual = plan.actions.filter((action) => action.kind === 'MANUAL_EXTERNAL_EVIDENCE');
  assert.deepEqual(
    manual.map((action) => action.id),
    ['ios_physical_validation', 'android_physical_validation', 'ios_store_submission', 'android_store_submission'],
  );
  assert.equal(manual.every((action) => action.command === null), true);
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
