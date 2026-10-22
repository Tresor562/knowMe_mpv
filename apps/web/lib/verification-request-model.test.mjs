import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasActiveVerificationApproval, canSubmitVerificationRequest,
  verificationWithdrawalReason
} from './verification-request-model.ts';

const now=new Date('2026-10-18T15:00:00.000Z');
test('approved verification without an expiration date is still active',()=>{
  assert.equal(hasActiveVerificationApproval([{status:'APPROVED',expiresAt:null}],now),true);
  assert.equal(canSubmitVerificationRequest([{status:'APPROVED',expiresAt:null}],now),false);
});
test('expired approval permits a fresh request unless another request is pending',()=>{
  assert.equal(canSubmitVerificationRequest([{status:'APPROVED',expiresAt:'2026-01-01T00:00:00Z'}],now),true);
  assert.equal(canSubmitVerificationRequest([{status:'UNDER_REVIEW'}],now),false);
});
test('cancel or invalid withdrawal reason cannot be submitted',()=>{
  assert.equal(verificationWithdrawalReason(null),null);
  assert.equal(verificationWithdrawalReason('  '),null);
  assert.equal(verificationWithdrawalReason(' ok '),null);
  assert.equal(verificationWithdrawalReason('  Please withdraw  '),'Please withdraw');
  assert.equal(verificationWithdrawalReason('x'.repeat(501)),null);
});
