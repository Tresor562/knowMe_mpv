#!/usr/bin/env node

import tls from 'node:tls';
import { open, unlink } from 'node:fs/promises';

import { canonicalProductionBaseUrl } from './production-deployment-smoke.mjs';

const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const MIN_VALIDITY_DAYS = 1;
const MAX_VALIDITY_DAYS = 365;
const SHA256 = /^[0-9a-f]{64}$/;

function canonicalInteger(value, { min, max }) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
  }
  if (typeof value !== 'string' || value !== value.trim() || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function canonicalUtcTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function canonicalFingerprint(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replaceAll(':', '').toLowerCase();
  return SHA256.test(normalized) ? normalized : null;
}

export function validateTlsProbeResult(probe, { now = new Date(), minValidityDays = 14 } = {}) {
  if (!probe || probe.authorized !== true) throw new Error('Production TLS peer must be authorized by the platform trust store.');
  if (!probe.peerCertificate || typeof probe.peerCertificate !== 'object') throw new Error('Production TLS peer certificate is missing.');

  const validFrom = canonicalUtcTimestamp(probe.peerCertificate.valid_from);
  const validTo = canonicalUtcTimestamp(probe.peerCertificate.valid_to);
  const fingerprintSha256 = canonicalFingerprint(probe.peerCertificate.fingerprint256);
  if (!validFrom || !validTo) throw new Error('Production TLS certificate validity window is invalid.');
  if (!fingerprintSha256) throw new Error('Production TLS certificate SHA-256 fingerprint is invalid.');

  const nowMs = now.getTime();
  const validFromMs = Date.parse(validFrom);
  const validToMs = Date.parse(validTo);
  if (!Number.isFinite(nowMs)) throw new Error('TLS smoke current time is invalid.');
  if (nowMs < validFromMs || nowMs > validToMs) throw new Error('Production TLS certificate is not currently valid.');

  const remainingValidityMs = validToMs - nowMs;
  const requiredValidityMs = minValidityDays * 24 * 60 * 60 * 1000;
  if (remainingValidityMs < requiredValidityMs) {
    throw new Error(`Production TLS certificate has less than ${minValidityDays} day(s) of remaining validity.`);
  }

  return {
    protocol: typeof probe.protocol === 'string' && probe.protocol.length > 0 ? probe.protocol : 'unknown',
    fingerprintSha256,
    validFrom,
    validTo,
    remainingValidityDays: Math.floor(remainingValidityMs / (24 * 60 * 60 * 1000)),
  };
}

export async function probeProductionTls({ hostname, port, timeoutMs }) {
  return await new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: true,
      timeout: timeoutMs,
    });

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    socket.once('secureConnect', () => {
      finish(resolve, {
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ?? null,
        protocol: socket.getProtocol() ?? 'unknown',
        peerCertificate: socket.getPeerCertificate(),
      });
    });
    socket.once('timeout', () => finish(reject, new Error('Production TLS handshake timed out.')));
    socket.once('error', (error) => finish(reject, error));
  });
}

export async function verifyProductionTlsDomain({
  baseUrl,
  minValidityDays = 14,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
  probeImpl = probeProductionTls,
} = {}) {
  const normalizedBaseUrl = canonicalProductionBaseUrl(baseUrl);
  if (!normalizedBaseUrl) throw new Error('Production TLS smoke URL must be a canonical HTTPS origin.');

  const normalizedMinValidityDays = canonicalInteger(minValidityDays, { min: MIN_VALIDITY_DAYS, max: MAX_VALIDITY_DAYS });
  if (normalizedMinValidityDays === null) {
    throw new Error(`TLS minimum validity must be an integer between ${MIN_VALIDITY_DAYS} and ${MAX_VALIDITY_DAYS} days.`);
  }
  const normalizedTimeoutMs = canonicalInteger(timeoutMs, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS });
  if (normalizedTimeoutMs === null) {
    throw new Error(`TLS smoke timeout must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`);
  }

  const url = new URL(normalizedBaseUrl);
  const port = url.port ? Number(url.port) : 443;
  const probe = await probeImpl({ hostname: url.hostname, port, timeoutMs: normalizedTimeoutMs });
  const tlsResult = validateTlsProbeResult(probe, { now, minValidityDays: normalizedMinValidityDays });
  const observedAt = now.toISOString();

  return {
    schemaVersion: 1,
    kind: 'knowme-production-tls-domain-smoke',
    status: 'PASSED',
    observedAt,
    origin: normalizedBaseUrl,
    hostname: url.hostname,
    port,
    minValidityDays: normalizedMinValidityDays,
    tls: tlsResult,
    proofBoundary: 'TLS/domain transport validation only; this does not prove deployment, monitoring, legal review, restore, antimalware, physical devices, or stores.',
  };
}

export async function writeProductionTlsDomainArtifact(outputPath, artifact) {
  if (typeof outputPath !== 'string' || outputPath !== outputPath.trim() || outputPath.length === 0 || /[\u0000-\u001f\u007f]/.test(outputPath)) {
    throw new Error('TLS smoke output path must be a canonical non-empty path without control characters.');
  }

  let handle;
  let created = false;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    await handle.sync();
  } catch (error) {
    if (created) await unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCli() {
  const baseUrl = readArg('--url') ?? process.env.KNOWME_PRODUCTION_BASE_URL;
  const minValidityDays = readArg('--min-validity-days') ?? process.env.KNOWME_PRODUCTION_TLS_MIN_VALIDITY_DAYS ?? '14';
  const timeoutMs = readArg('--timeout-ms') ?? process.env.KNOWME_PRODUCTION_TLS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS);
  const outputPath = readArg('--output');

  const artifact = await verifyProductionTlsDomain({ baseUrl, minValidityDays, timeoutMs });
  if (outputPath) await writeProductionTlsDomainArtifact(outputPath, artifact);
  console.log(`Production TLS/domain smoke passed for ${artifact.hostname}; certificate valid until ${artifact.tls.validTo}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
