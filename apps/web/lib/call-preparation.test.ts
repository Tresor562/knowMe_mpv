import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCallPreferenceUpdate,
  buildMediaConstraints,
  classifyMediaPreparationFailure,
  isCallMediaPrepared,
  mediaPreparationFailureMessage,
  minuteToTime,
  timeToMinute,
  type CallPreferenceFields,
} from './call-preparation.ts';

const preference: CallPreferenceFields & {
  userId: string;
  selectedMicrophoneId: string;
} = {
  userId: 'user-1',
  selectedMicrophoneId: 'private-hardware-id',
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
};

test('serializes only the authoritative preference allowlist', () => {
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
    expectedVersion: 4,
  });
  assert.equal('selectedMicrophoneId' in payload, false);
  assert.equal('userId' in payload, false);
});

test('keeps selected hardware identifiers inside local media constraints', () => {
  assert.deepEqual(buildMediaConstraints('video', 'mic-1', 'cam-2'), {
    audio: { deviceId: { exact: 'mic-1' } },
    video: { deviceId: { exact: 'cam-2' } },
  });
  assert.deepEqual(buildMediaConstraints('audio', '', 'cam-2'), {
    audio: true,
    video: false,
  });
});

test('requires a compatible local preview only when the saved policy does', () => {
  assert.equal(isCallMediaPrepared(null, 'audio', true), false);
  assert.equal(isCallMediaPrepared('audio', 'video', true), false);
  assert.equal(isCallMediaPrepared('video', 'audio', true), true);
  assert.equal(isCallMediaPrepared(null, 'video', false), true);
});

test('converts valid local-day minutes and safely bounds display values', () => {
  assert.equal(minuteToTime(0), '00:00');
  assert.equal(minuteToTime(1439), '23:59');
  assert.equal(minuteToTime(2000), '23:59');
  assert.equal(timeToMinute('22:05'), 1325);
  assert.equal(timeToMinute('24:00'), 0);
  assert.equal(timeToMinute('invalid'), 0);
});

test('maps browser media failures to actionable, privacy-safe states', () => {
  assert.equal(
    classifyMediaPreparationFailure({ name: 'NotAllowedError' }),
    'denied',
  );
  assert.equal(
    classifyMediaPreparationFailure({ name: 'NotFoundError' }),
    'missing-device',
  );
  assert.equal(
    classifyMediaPreparationFailure({ name: 'NotReadableError' }),
    'device-busy',
  );
  assert.match(
    mediaPreparationFailureMessage('unsupported-constraint'),
    /appareil choisi/i,
  );
});
