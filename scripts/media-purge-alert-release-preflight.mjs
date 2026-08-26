const MIN_TOKEN_LENGTH = 32;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 10_000;

const OTHER_SECRET_KEYS = [
  'JWT_SECRET',
  'KNOWME_BACKUP_MANIFEST_SIGNING_KEY',
  'METRICS_BEARER_TOKEN',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'MEDIA_SCANNER_TOKEN',
  'STICKER_TOKEN_ACTIVE_SECRET',
  'ACCOUNT_RECOVERY_SECRET',
  'ACCOUNT_RECOVERY_EMAIL_API_KEY',
  'CALL_TURN_SECRET',
  'NEXUS_KNOWME_SHARED_SECRET',
  'PAYMENTS_DATA_ENCRYPTION_KEY',
  'PAYMENTS_FRAUD_HASH_SALT'
];

function requireCanonicalInteger(env, key, min, max) {
  const raw = env[key];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`${key} is required for a market release.`);
  }
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${key} must be a canonical integer between ${min} and ${max}.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max || String(parsed) !== normalized) {
    throw new Error(`${key} must be a canonical integer between ${min} and ${max}.`);
  }
  return parsed;
}

function validateEndpoint(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('MEDIA_PURGE_ALERT_WEBHOOK_URL is required for a market release.');
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('MEDIA_PURGE_ALERT_WEBHOOK_URL must be a valid HTTPS URL.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(
      'MEDIA_PURGE_ALERT_WEBHOOK_URL must use HTTPS and contain no credentials, query string, or fragment.'
    );
  }
  return url.toString();
}

function validateDedicatedToken(env) {
  const raw = env.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN;
  if (typeof raw !== 'string' || raw.length < MIN_TOKEN_LENGTH || raw !== raw.trim()) {
    throw new Error(
      `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN must be a dedicated token of at least ${MIN_TOKEN_LENGTH} characters without surrounding whitespace.`
    );
  }

  for (const otherKey of OTHER_SECRET_KEYS) {
    const other = env[otherKey];
    if (typeof other === 'string' && other.length > 0 && other === raw) {
      throw new Error(`MEDIA_PURGE_ALERT_WEBHOOK_TOKEN must be distinct from ${otherKey}.`);
    }
  }
  return raw;
}

export function validateMediaPurgeAlertReleaseEnv(env = process.env) {
  return {
    endpoint: validateEndpoint(env.MEDIA_PURGE_ALERT_WEBHOOK_URL),
    token: validateDedicatedToken(env),
    timeoutMs: requireCanonicalInteger(
      env,
      'MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS',
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    )
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const policy = validateMediaPurgeAlertReleaseEnv(process.env);
    console.log(`Media purge alert release preflight passed (timeout=${policy.timeoutMs}ms).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
