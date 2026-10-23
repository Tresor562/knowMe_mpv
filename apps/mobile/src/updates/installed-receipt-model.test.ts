import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  installedUpdateNoticeStorageKey,
  shouldAutoAcknowledgeInstalledUpdate,
  shouldDisplayBackgroundUpdateStatus
} from './installed-receipt-model.ts';

test('successful Android updates never display the confirmation overlay', () => {
  assert.equal(shouldDisplayBackgroundUpdateStatus('installed', 0), false);
  assert.equal(shouldDisplayBackgroundUpdateStatus('installed', 11654), false);
  assert.equal(shouldDisplayBackgroundUpdateStatus('none', 0), false);
});

test('downloads and installation retries still show their nonblocking status', () => {
  assert.equal(shouldDisplayBackgroundUpdateStatus('downloading', 0), true);
  assert.equal(shouldDisplayBackgroundUpdateStatus('ready', 0), true);
  assert.equal(shouldDisplayBackgroundUpdateStatus('failed', 0), true);
  assert.equal(shouldDisplayBackgroundUpdateStatus('ready', 11655), false);
});

test('verified installed version is acknowledged once per mounted session', () => {
  assert.equal(shouldAutoAcknowledgeInstalledUpdate(11654, 0), true);
  assert.equal(shouldAutoAcknowledgeInstalledUpdate(11654, 11654), false);
  assert.equal(shouldAutoAcknowledgeInstalledUpdate(11655, 11654), true);
});

test('invalid Android update versions are never acknowledged', () => {
  for (const value of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, 1.25]) {
    assert.equal(shouldAutoAcknowledgeInstalledUpdate(value, 0), false);
  }
});

test('legacy receipt storage key remains stable for compatibility', () => {
  assert.equal(installedUpdateNoticeStorageKey(11654),
    'knowme.android.installed-update-dismissed.v1.11654');
});
