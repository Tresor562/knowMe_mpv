import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CIRCLE_NOTIFICATION_PREFERENCE as defaults,
  clockToMinute, minuteToClock, profileCirclePreferencePayload,
  profileCirclePreferenceError, toggleCircleMuted
} from './profile-circle-notification-editor.ts';

test('all API mandatory schedule fields are preserved on ordinary toggles', () => {
  const form = { ...defaults, enabled: false, quietHoursEnabled: true,
    quietStartMinute: 23 * 60 + 15, quietEndMinute: 6 * 60,
    timezone: 'Africa/Porto-Novo', digestMode: 'DAILY', digestMinuteOfDay: 9 * 60 };
  const payload = profileCirclePreferencePayload(form);
  assert.equal(payload.enabled, false);
  assert.equal(payload.quietStartMinute, 1395);
  assert.equal(payload.quietEndMinute, 360);
  assert.equal(payload.digestMinuteOfDay, 540);
  assert.equal(payload.timezone, 'Africa/Porto-Novo');
  assert.equal(payload.digestMode, 'DAILY');
  assert.equal(Object.keys(payload).length, 14);
});

test('time conversions reject invalid clock inputs instead of silently persisting them', () => {
  assert.equal(minuteToClock(0), '00:00');
  assert.equal(minuteToClock(1439), '23:59');
  assert.equal(clockToMinute('22:30'), 1350);
  assert.equal(clockToMinute('24:00'), null);
  assert.equal(clockToMinute('12:60'), null);
  assert.equal(clockToMinute('bad'), null);
});

test('timezone and minute validations match the server schedule contract', () => {
  assert.equal(profileCirclePreferenceError({ ...defaults, timezone: 'Bad/Timezone' }), 'timezone');
  assert.equal(profileCirclePreferenceError({ ...defaults, quietEndMinute: -1 }), 'time');
  assert.throws(() => profileCirclePreferencePayload({...defaults, digestMinuteOfDay: 1440}), /INVALID_TIME/);
});

test('muting and unmuting circles preserves the rest of the notification schedule', () => {
  const muted = toggleCircleMuted(defaults, 'circle-1');
  assert.deepEqual(muted.mutedCircleIds, ['circle-1']);
  assert.deepEqual(toggleCircleMuted(muted, 'circle-1').mutedCircleIds, []);
  assert.equal(muted.quietStartMinute, defaults.quietStartMinute);
  assert.equal(muted.digestMode, defaults.digestMode);
});

test('deduplication and blank circle IDs cannot corrupt the API payload', () => {
  assert.deepEqual(profileCirclePreferencePayload({ ...defaults,
    mutedCircleIds:['abc', 'abc', 'def'] }).mutedCircleIds,['abc','def']);
  assert.equal(profileCirclePreferenceError({ ...defaults,
    mutedCircleIds:[''] }), 'muted');
});
