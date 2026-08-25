const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 100;

function canonicalInteger(env, name, min, max) {
  const raw = env[name]?.trim();
  if (!raw) throw new Error(`${name} is required for a market release.`);
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a canonical positive integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

export function validateMediaQuarantineRetryReleasePolicy(env = process.env) {
  const enabled = env.MEDIA_QUARANTINE_RETRY_ENABLED?.trim();
  if (enabled !== 'true' && enabled !== 'false') {
    throw new Error('MEDIA_QUARANTINE_RETRY_ENABLED must be explicitly set to canonical true or false for a market release.');
  }

  const intervalMs = canonicalInteger(
    env,
    'MEDIA_QUARANTINE_RETRY_INTERVAL_MS',
    MIN_INTERVAL_MS,
    MAX_INTERVAL_MS
  );
  const batchSize = canonicalInteger(
    env,
    'MEDIA_QUARANTINE_RETRY_BATCH_SIZE',
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE
  );

  return { enabled: enabled === 'true', intervalMs, batchSize };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateMediaQuarantineRetryReleasePolicy(process.env);
    console.log('Media quarantine retry release preflight passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Media quarantine retry release preflight failed.');
    process.exitCode = 1;
  }
}
