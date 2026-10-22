import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  installedUpdateNoticeStorageKey,
  shouldHideInstalledUpdateNotice
} from './installed-receipt-model.ts';

test('Android installed receipt closes immediately after tapping Continue', async () => {
  let storageCalled = false;
  assert.equal(await shouldHideInstalledUpdateNotice(11654, 11654, async () => {
    storageCalled = true;
    throw new Error('storage unavailable');
  }), true);
  assert.equal(storageCalled, false, 'in-memory dismissal is synchronous');
});

test('verified update notice stays dismissed after app relaunch', async () => {
  const stored = new Map([[installedUpdateNoticeStorageKey(11654), '1']]);
  assert.equal(await shouldHideInstalledUpdateNotice(11654, 0,
    async (key) => stored.get(key) ?? null), true);
  assert.equal(await shouldHideInstalledUpdateNotice(11655, 0,
    async (key) => stored.get(key) ?? null), false,
  'a new installed version must show its own notice');
});

test('failed or absent storage reads do not invent a prior acknowledgement', async () => {
  assert.equal(await shouldHideInstalledUpdateNotice(11654, 0,
    async () => null), false);
  assert.equal(await shouldHideInstalledUpdateNotice(11654, 0,
    async () => { throw new Error('storage offline'); }), false);
  assert.equal(await shouldHideInstalledUpdateNotice(-1, -1,
    async () => '1'), false);
});

test('completion UI dismisses the modal before native cleanup', () => {
  const ui = readFileSync(new URL('./MobileUpdateNotice.tsx', import.meta.url), 'utf8');
  const handler = ui.split('const acknowledgeInstalled = () => {')[1]?.split('\n  };')[0];
  assert.ok(handler, 'Continue must have a completion handler');
  const dismissAt = handler.indexOf('setBackgroundStatus(null)');
  const nativeAt = handler.indexOf('installer.acknowledgeInstalledUpdate()');
  assert.ok(dismissAt >= 0, 'Continue must dismiss the modal synchronously');
  assert.ok(nativeAt > dismissAt, 'native receipt cleanup may only run after dismissal');
  assert.doesNotMatch(handler.slice(0, dismissAt), /\bawait\b/);
  assert.match(ui, /onPress=\{\(\) => void acknowledgeInstalled\(\)\}/);
  assert.match(ui, /onRequestClose=\{\(\) => void acknowledgeInstalled\(\)\}/);
});
