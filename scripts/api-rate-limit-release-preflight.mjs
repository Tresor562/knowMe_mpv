#!/usr/bin/env node

const MIN_TTL_MS = 1_000;
const MAX_TTL_MS = 3_600_000;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100_000;
const SUPPORTED_PROCESS_LOCAL_INSTANCE_COUNT = 1;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireBoundedInteger(env, key, min, max, errors) {
  const raw = env[key];
  if (!nonEmpty(raw)) {
    errors.push(`${key} must be explicitly configured for a market release.`);
    return;
  }
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
  }
}

function requireSupportedInstanceCount(env, errors) {
  const raw = env.API_INSTANCE_COUNT;
  if (!nonEmpty(raw)) {
    errors.push(
      'API_INSTANCE_COUNT must be explicitly configured for a market release because the current throttler store is process-local.',
    );
    return;
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    errors.push('API_INSTANCE_COUNT must be the canonical integer 1 while rate limiting uses process-local storage.');
    return;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed !== SUPPORTED_PROCESS_LOCAL_INSTANCE_COUNT) {
    errors.push(
      'API_INSTANCE_COUNT must be 1 while rate limiting uses process-local storage; configure a validated shared/edge limiter before horizontal scaling.',
    );
  }
}

export function validateApiRateLimitReleaseEnvironment(env = process.env) {
  const errors = [];
  requireBoundedInteger(env, 'API_RATE_LIMIT_TTL_MS', MIN_TTL_MS, MAX_TTL_MS, errors);
  requireBoundedInteger(env, 'API_RATE_LIMIT_LIMIT', MIN_LIMIT, MAX_LIMIT, errors);
  requireSupportedInstanceCount(env, errors);
  return { ok: errors.length === 0, errors };
}

function runCli() {
  const result = validateApiRateLimitReleaseEnvironment(process.env);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`API rate-limit release preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('API rate-limit release preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
