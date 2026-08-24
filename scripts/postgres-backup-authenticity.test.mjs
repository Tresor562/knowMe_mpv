import assert from 'node:assert/strict';
import test from 'node:test';
import {
  manifestForBackup,
  requireBackupManifestSigningKey,
  verifyBackupManifestAuthenticity,
} from './postgres-backup-lib.mjs';

const SIGNING_KEY = 'correct-backup-manifest-signing-key-0001';
const WRONG_KEY = 'incorrect-backup-manifest-signing-key-02';

function manifest() {
  return manifestForBackup({
    filePath: '/secure/knowme.dump',
    sha256: 'f'.repeat(64),
    createdAt: new Date('2026-08-24T05:00:00.000Z'),
    signingKey: SIGNING_KEY,
  });
}

test('backup signing key is mandatory and bounded', () => {
  assert.throws(() => requireBackupManifestSigningKey(), /at least 32/);
  assert.throws(() => requireBackupManifestSigningKey('too-short'), /at least 32/);
  assert.equal(requireBackupManifestSigningKey(SIGNING_KEY), SIGNING_KEY);
});

test('signed manifest verifies with the same secret', () => {
  const signed = manifest();
  assert.equal(verifyBackupManifestAuthenticity(signed, SIGNING_KEY), signed);
});

test('manifest tampering is rejected even when metadata remains structurally valid', () => {
  const signed = manifest();
  assert.throws(
    () => verifyBackupManifestAuthenticity({ ...signed, sha256: 'a'.repeat(64) }, SIGNING_KEY),
    /authenticity check failed/,
  );
  assert.throws(
    () => verifyBackupManifestAuthenticity({ ...signed, file: 'other.dump' }, SIGNING_KEY),
    /authenticity check failed/,
  );
});

test('wrong signing key is rejected', () => {
  assert.throws(
    () => verifyBackupManifestAuthenticity(manifest(), WRONG_KEY),
    /authenticity check failed/,
  );
});

test('invalid signature metadata is rejected before comparison', () => {
  const signed = manifest();
  assert.throws(
    () =>
      verifyBackupManifestAuthenticity(
        { ...signed, signature: { algorithm: 'sha256', value: signed.signature.value } },
        SIGNING_KEY,
      ),
    /signature is invalid/,
  );
  assert.throws(
    () =>
      verifyBackupManifestAuthenticity(
        { ...signed, signature: { algorithm: 'hmac-sha256', value: 'not-a-signature' } },
        SIGNING_KEY,
      ),
    /signature is invalid/,
  );
});

test('unsigned schema v1 backups require an explicit legacy override', () => {
  const legacy = {
    schemaVersion: 1,
    file: 'knowme.dump',
    sha256: 'b'.repeat(64),
    createdAt: '2026-08-20T00:00:00.000Z',
    format: 'postgresql-custom',
    containsSecrets: true,
  };

  assert.throws(
    () => verifyBackupManifestAuthenticity(legacy, undefined),
    /Unsigned legacy backup manifest refused/,
  );
  assert.equal(
    verifyBackupManifestAuthenticity(legacy, undefined, { allowUnsignedLegacy: true }),
    legacy,
  );
});
