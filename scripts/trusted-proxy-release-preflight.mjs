#!/usr/bin/env node

const MIN_HOPS = 0;
const MAX_HOPS = 5;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateTrustedProxyReleaseEnvironment(env = process.env) {
  const errors = [];
  const raw = env.TRUSTED_PROXY_HOPS;

  if (!nonEmpty(raw)) {
    errors.push('TRUSTED_PROXY_HOPS must be explicitly configured for a market release.');
    return { ok: false, errors };
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    errors.push(`TRUSTED_PROXY_HOPS must be an integer between ${MIN_HOPS} and ${MAX_HOPS}.`);
    return { ok: false, errors };
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_HOPS || parsed > MAX_HOPS) {
    errors.push(`TRUSTED_PROXY_HOPS must be an integer between ${MIN_HOPS} and ${MAX_HOPS}.`);
  }

  return { ok: errors.length === 0, errors };
}

function runCli() {
  const result = validateTrustedProxyReleaseEnvironment(process.env);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Trusted proxy release preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Trusted proxy release preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
