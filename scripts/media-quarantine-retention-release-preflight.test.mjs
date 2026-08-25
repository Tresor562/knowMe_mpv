import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMediaQuarantineRetentionReleaseEnv } from './media-quarantine-retention-release-preflight.mjs';

const validEnv = {
  MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: '30',
  MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: '7'
};

test('accepts explicit canonical quarantine retention windows', () => {
  assert.deepEqual(validateMediaQuarantineRetentionReleaseEnv(validEnv), {
    infectedRetentionDays: 30,
    unavailableRetentionDays: 7
  });
});

for (const name of ['MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS', 'MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS']) {
  test(`requires ${name}`, () => {
    const env = { ...validEnv };
    delete env[name];
    assert.throws(() => validateMediaQuarantineRetentionReleaseEnv(env), new RegExp(`${name} is required`));
  });

  for (const value of ['0', '-1', '1.5', '01', '3651', 'abc']) {
    test(`rejects non-canonical or out-of-range ${name}=${value}`, () => {
      assert.throws(
        () => validateMediaQuarantineRetentionReleaseEnv({ ...validEnv, [name]: value }),
        new RegExp(`${name} must be a canonical integer between 1 and 3650`)
      );
    });
  }

  for (const value of ['1', '3650']) {
    test(`accepts boundary ${name}=${value}`, () => {
      assert.doesNotThrow(() => validateMediaQuarantineRetentionReleaseEnv({ ...validEnv, [name]: value }));
    });
  }
}
