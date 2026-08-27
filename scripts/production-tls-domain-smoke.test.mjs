import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  validateTlsProbeResult,
  verifyProductionTlsDomain,
  writeProductionTlsDomainArtifact,
} from './production-tls-domain-smoke.mjs';

const NOW = new Date('2026-08-27T14:00:00.000Z');
const FINGERPRINT = 'ab'.repeat(32).match(/.{2}/g).join(':').toUpperCase();

function validProbe(overrides = {}) {
  return {
    authorized: true,
    protocol: 'TLSv1.3',
    peerCertificate: {
      valid_from: 'Aug 1 00:00:00 2026 GMT',
      valid_to: 'Nov 30 00:00:00 2026 GMT',
      fingerprint256: FINGERPRINT,
    },
    ...overrides,
  };
}

test('validates an authorized certificate with sufficient remaining lifetime', () => {
  const result = validateTlsProbeResult(validProbe(), { now: NOW, minValidityDays: 30 });
  assert.equal(result.protocol, 'TLSv1.3');
  assert.equal(result.fingerprintSha256, 'ab'.repeat(32));
  assert.ok(result.remainingValidityDays >= 30);
});

test('rejects unauthorized, expired, near-expiry and malformed certificate probes', () => {
  assert.throws(() => validateTlsProbeResult(validProbe({ authorized: false }), { now: NOW, minValidityDays: 14 }), /authorized/);
  assert.throws(
    () => validateTlsProbeResult(validProbe({ peerCertificate: { ...validProbe().peerCertificate, valid_to: 'Aug 20 00:00:00 2026 GMT' } }), { now: NOW, minValidityDays: 14 }),
    /not currently valid/,
  );
  assert.throws(
    () => validateTlsProbeResult(validProbe({ peerCertificate: { ...validProbe().peerCertificate, valid_to: 'Sep 1 00:00:00 2026 GMT' } }), { now: NOW, minValidityDays: 14 }),
    /less than 14 day/,
  );
  assert.throws(
    () => validateTlsProbeResult(validProbe({ peerCertificate: { ...validProbe().peerCertificate, fingerprint256: 'nope' } }), { now: NOW, minValidityDays: 14 }),
    /fingerprint/,
  );
});

test('verifies a canonical HTTPS production origin and emits bounded evidence', async () => {
  let observedInput;
  const artifact = await verifyProductionTlsDomain({
    baseUrl: 'https://api.knowme.example',
    minValidityDays: '30',
    timeoutMs: '5000',
    now: NOW,
    probeImpl: async (input) => {
      observedInput = input;
      return validProbe();
    },
  });

  assert.deepEqual(observedInput, { hostname: 'api.knowme.example', port: 443, timeoutMs: 5000 });
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.kind, 'knowme-production-tls-domain-smoke');
  assert.equal(artifact.status, 'PASSED');
  assert.equal(artifact.origin, 'https://api.knowme.example/');
  assert.equal(artifact.hostname, 'api.knowme.example');
  assert.equal(artifact.observedAt, NOW.toISOString());
  assert.equal(artifact.tls.fingerprintSha256, 'ab'.repeat(32));
});

test('rejects cleartext, ambiguous origins and non-canonical policy values before probing', async () => {
  let probes = 0;
  const probeImpl = async () => {
    probes += 1;
    return validProbe();
  };

  await assert.rejects(() => verifyProductionTlsDomain({ baseUrl: 'http://api.knowme.example', probeImpl }), /canonical HTTPS origin/);
  await assert.rejects(() => verifyProductionTlsDomain({ baseUrl: 'https://api.knowme.example/path', probeImpl }), /canonical HTTPS origin/);
  await assert.rejects(() => verifyProductionTlsDomain({ baseUrl: 'https://api.knowme.example', minValidityDays: '01', probeImpl }), /minimum validity/);
  await assert.rejects(() => verifyProductionTlsDomain({ baseUrl: 'https://api.knowme.example', timeoutMs: '0500', probeImpl }), /timeout/);
  assert.equal(probes, 0);
});

test('does not overwrite an existing TLS smoke artifact', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-kmd287-'));
  const output = path.join(dir, 'tls.json');
  await writeFile(output, 'existing\n', 'utf8');

  await assert.rejects(
    () => writeProductionTlsDomainArtifact(output, { status: 'PASSED' }),
    (error) => error?.code === 'EEXIST',
  );
  assert.equal(await readFile(output, 'utf8'), 'existing\n');
});

test('writes the exact validated artifact with a terminal newline', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'knowme-kmd287-write-'));
  const output = path.join(dir, 'tls.json');
  const artifact = await verifyProductionTlsDomain({
    baseUrl: 'https://api.knowme.example',
    minValidityDays: 30,
    timeoutMs: 5000,
    now: NOW,
    probeImpl: async () => validProbe(),
  });

  await writeProductionTlsDomainArtifact(output, artifact);
  assert.equal(await readFile(output, 'utf8'), `${JSON.stringify(artifact, null, 2)}\n`);
});
