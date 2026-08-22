#!/usr/bin/env node

const HTTPS_URL_KEYS = ['NEXT_PUBLIC_API_URL'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const ISOLATED_SECRET_KEYS = [
  'JWT_SECRET',
  'METRICS_BEARER_TOKEN',
  'MEDIA_S3_SECRET_ACCESS_KEY',
  'STICKER_TOKEN_ACTIVE_SECRET',
  'ACCOUNT_RECOVERY_SECRET',
  'ACCOUNT_RECOVERY_EMAIL_API_KEY',
  'CALL_TURN_SECRET',
  'NEXUS_KNOWME_SHARED_SECRET',
  'PAYMENTS_DATA_ENCRYPTION_KEY',
  'PAYMENTS_FRAUD_HASH_SALT'
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseBoolean(value, fallback = false) {
  if (!nonEmpty(value)) return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function parseJsonArray(value, key, errors) {
  if (!nonEmpty(value)) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      errors.push(`${key} must be a JSON array.`);
      return [];
    }
    return parsed;
  } catch {
    errors.push(`${key} must contain valid JSON.`);
    return [];
  }
}

function requireSecret(env, key, minLength, errors) {
  const value = env[key];
  if (!nonEmpty(value) || value.trim().length < minLength) {
    errors.push(`${key} must be set to at least ${minLength} characters.`);
  }
}

function validateSecretIsolation(env, errors) {
  const ownersBySecret = new Map();
  for (const key of ISOLATED_SECRET_KEYS) {
    if (!nonEmpty(env[key])) continue;
    const normalized = env[key].trim();
    const previous = ownersBySecret.get(normalized);
    if (previous) {
      errors.push(`${key} must be distinct from ${previous}; production secrets may not be reused across trust boundaries.`);
      continue;
    }
    ownersBySecret.set(normalized, key);
  }
}

function requireHttps(env, key, errors) {
  const value = env[key];
  if (!nonEmpty(value)) {
    errors.push(`${key} must be set.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${key} must use HTTPS in production.`);
    if (LOCAL_HOSTS.has(url.hostname)) {
      errors.push(`${key} must not point to a local host in production.`);
    }
  } catch {
    errors.push(`${key} must be a valid URL.`);
  }
}

function validateBoundedInteger(env, key, fallback, min, max, errors) {
  const raw = nonEmpty(env[key]) ? env[key].trim() : String(fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
  }
}

function validateCorsOrigins(env, errors) {
  const values = parseJsonArray(env.CORS_ALLOWED_ORIGINS_JSON, 'CORS_ALLOWED_ORIGINS_JSON', errors);
  if (values.length === 0) {
    errors.push('CORS_ALLOWED_ORIGINS_JSON must contain at least one production Web origin.');
    return;
  }

  for (const item of values) {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push('CORS_ALLOWED_ORIGINS_JSON may contain only non-empty origin strings.');
      continue;
    }
    const raw = item.trim();
    if (raw.includes('*')) {
      errors.push('CORS_ALLOWED_ORIGINS_JSON must not contain wildcard origins.');
      continue;
    }
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:') {
        errors.push(`CORS origin must use HTTPS in production: ${raw}`);
      }
      if (LOCAL_HOSTS.has(url.hostname)) {
        errors.push(`CORS origin must not use a local host in production: ${raw}`);
      }
      if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        errors.push(`CORS origin must not include credentials, a path, query, or fragment: ${raw}`);
      }
    } catch {
      errors.push(`CORS_ALLOWED_ORIGINS_JSON contains an invalid URL: ${raw}`);
    }
  }
}

function validateMediaStorage(env, errors) {
  if (env.MEDIA_STORAGE_DRIVER !== 's3') {
    errors.push('MEDIA_STORAGE_DRIVER must be "s3" for a market release; local API disk is not durable production media storage.');
    return;
  }
  requireHttps(env, 'MEDIA_S3_ENDPOINT', errors);
  if (!nonEmpty(env.MEDIA_S3_BUCKET)) errors.push('MEDIA_S3_BUCKET must be set.');
  if (!nonEmpty(env.MEDIA_S3_REGION)) errors.push('MEDIA_S3_REGION must be set.');
  if (!nonEmpty(env.MEDIA_S3_ACCESS_KEY_ID)) errors.push('MEDIA_S3_ACCESS_KEY_ID must be set.');
  requireSecret(env, 'MEDIA_S3_SECRET_ACCESS_KEY', 32, errors);
  validateBoundedInteger(env, 'MEDIA_S3_TIMEOUT_MS', 30000, 1000, 60000, errors);
  validateBoundedInteger(env, 'MEDIA_S3_MAX_ATTEMPTS', 3, 1, 5, errors);
}

export function validateProductionEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];

  if (env.NODE_ENV !== 'production') {
    errors.push('NODE_ENV must be exactly "production" for a production release preflight.');
  }

  if (!nonEmpty(env.DATABASE_URL)) {
    errors.push('DATABASE_URL must be set.');
  } else {
    try {
      const databaseUrl = new URL(env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
        errors.push('DATABASE_URL must use PostgreSQL.');
      }
      if (LOCAL_HOSTS.has(databaseUrl.hostname)) {
        errors.push('DATABASE_URL must not point to a local host in production.');
      }
    } catch {
      errors.push('DATABASE_URL must be a valid PostgreSQL URL.');
    }
  }

  requireSecret(env, 'JWT_SECRET', 32, errors);
  requireSecret(env, 'METRICS_BEARER_TOKEN', 32, errors);
  for (const key of HTTPS_URL_KEYS) requireHttps(env, key, errors);
  validateCorsOrigins(env, errors);
  validateMediaStorage(env, errors);
  requireSecret(env, 'STICKER_TOKEN_ACTIVE_SECRET', 32, errors);

  const recoveryEnabled = parseBoolean(env.ACCOUNT_RECOVERY_ENABLED, true);
  if (recoveryEnabled) {
    requireSecret(env, 'ACCOUNT_RECOVERY_SECRET', 32, errors);
    requireHttps(env, 'ACCOUNT_RECOVERY_EMAIL_ENDPOINT', errors);
    requireSecret(env, 'ACCOUNT_RECOVERY_EMAIL_API_KEY', 16, errors);
    if (!nonEmpty(env.ACCOUNT_RECOVERY_EMAIL_FROM)) {
      errors.push('ACCOUNT_RECOVERY_EMAIL_FROM must be set to a verified sender identity.');
    }
    requireHttps(env, 'WEB_URL', errors);
  } else {
    errors.push('ACCOUNT_RECOVERY_ENABLED must not be disabled for a market release.');
  }

  const requireTurn = parseBoolean(env.CALL_REQUIRE_TURN_IN_PRODUCTION, true);
  if (requireTurn) {
    requireSecret(env, 'CALL_TURN_SECRET', 32, errors);
    const turnUrls = parseJsonArray(env.CALL_TURN_URLS_JSON, 'CALL_TURN_URLS_JSON', errors);
    if (turnUrls.length === 0) errors.push('CALL_TURN_URLS_JSON must contain at least one TURN endpoint.');
    for (const item of turnUrls) {
      if (typeof item !== 'string' || !/^turns?:/i.test(item)) {
        errors.push('CALL_TURN_URLS_JSON may contain only turn: or turns: URLs.');
        break;
      }
    }
  }

  const nexusEnabled = parseBoolean(env.NEXUS_INTEGRATION_ENABLED, false);
  if (nexusEnabled) {
    requireSecret(env, 'NEXUS_KNOWME_SHARED_SECRET', 32, errors);
    requireHttps(env, 'NEXUS_SERVER_URL', errors);
  }

  const webCatalog = parseJsonArray(env.PAYMENTS_WEB_CATALOG_JSON, 'PAYMENTS_WEB_CATALOG_JSON', errors);
  const storeCatalog = parseJsonArray(env.PAYMENTS_STORE_CATALOG_JSON, 'PAYMENTS_STORE_CATALOG_JSON', errors);
  if (webCatalog.length > 0 || storeCatalog.length > 0) {
    requireSecret(env, 'PAYMENTS_DATA_ENCRYPTION_KEY', 32, errors);
    requireSecret(env, 'PAYMENTS_FRAUD_HASH_SALT', 32, errors);
    if (webCatalog.length > 0) {
      requireHttps(env, 'PAYMENTS_PUBLIC_API_URL', errors);
      requireHttps(env, 'PAYMENTS_RETURN_URL', errors);
    }
  } else {
    warnings.push('No payment catalog is configured; monetization must remain disabled for this release.');
  }

  validateSecretIsolation(env, errors);

  return { ok: errors.length === 0, errors, warnings };
}

function runCli() {
  const result = validateProductionEnvironment(process.env);
  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Production release preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Production release preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
