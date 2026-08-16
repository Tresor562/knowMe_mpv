import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCallPreferenceUpdate,
  isMobilePreparationReady,
  minuteToTime,
  parseTimeToMinute,
  permissionLabel,
  type CallPreferenceFields
} from './call-preparation.ts';

const preference: CallPreferenceFields & {
  userId: string;
  selectedCameraFacing: string;
} = {
  userId: 'user-1',
  selectedCameraFacing: 'front',
  incomingCallsEnabled: true,
  allowAudioCalls: true,
  allowVideoCalls: false,
  quietHoursEnabled: true,
  quietStartMinute: 1320,
  quietEndMinute: 420,
  timezone: 'Africa/Porto-Novo',
  microphoneEnabledByDefault: false,
  cameraEnabledByDefault: false,
  devicePreviewRequired: true
};

test('serializes only the authoritative mobile preference allowlist', () => {
  const payload = buildCallPreferenceUpdate(preference, 4);

  assert.deepEqual(payload, {
    incomingCallsEnabled: true,
    allowAudioCalls: true,
    allowVideoCalls: false,
    quietHoursEnabled: true,
    quietStartMinute: 1320,
    quietEndMinute: 420,
    timezone: 'Africa/Porto-Novo',
    microphoneEnabledByDefault: false,
    cameraEnabledByDefault: false,
    devicePreviewRequired: true,
    expectedVersion: 4
  });
  assert.equal('selectedCameraFacing' in payload, false);
  assert.equal('userId' in payload, false);
});

test('parses valid quiet-hour drafts without silently accepting bad times', () => {
  assert.equal(minuteToTime(0), '00:00');
  assert.equal(minuteToTime(1439), '23:59');
  assert.equal(minuteToTime(2000), '23:59');
  assert.equal(parseTimeToMinute('22:05'), 1325);
  assert.equal(parseTimeToMinute('24:00'), null);
  assert.equal(parseTimeToMinute('9:00'), null);
});

test('requires microphone permission and a ready camera preview for video', () => {
  const granted = { granted: true, canAskAgain: true };
  const denied = { granted: false, canAskAgain: false };

  assert.equal(isMobilePreparationReady('audio', granted, null, false), true);
  assert.equal(isMobilePreparationReady('audio', denied, granted, true), false);
  assert.equal(
    isMobilePreparationReady('video', granted, granted, false),
    false
  );
  assert.equal(isMobilePreparationReady('video', granted, granted, true), true);
});

test('distinguishes a requestable permission from an operating-system refusal', () => {
  assert.equal(permissionLabel(null), 'Vérification en cours');
  assert.equal(
    permissionLabel({ granted: false, canAskAgain: true }),
    'À demander'
  );
  assert.equal(
    permissionLabel({ granted: false, canAskAgain: false }),
    'Refusée dans les réglages'
  );
});
