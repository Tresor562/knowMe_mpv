export const DEFAULT_API_RATE_LIMIT_TTL_MS = 60_000;
export const DEFAULT_API_RATE_LIMIT_LIMIT = 120;
export const MIN_API_RATE_LIMIT_TTL_MS = 1_000;
export const MAX_API_RATE_LIMIT_TTL_MS = 3_600_000;
export const MIN_API_RATE_LIMIT_LIMIT = 1;
export const MAX_API_RATE_LIMIT_LIMIT = 100_000;
export const SUPPORTED_PROCESS_LOCAL_API_INSTANCE_COUNT = 1;

function parseBoundedInteger(
  raw: string | undefined,
  label: string,
  fallback: number,
  min: number,
  max: number,
  requireExplicit: boolean,
): number {
  if (raw === undefined || raw.trim() === '') {
    if (requireExplicit) {
      throw new Error(`${label} must be explicitly configured in production`);
    }
    return fallback;
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function assertSupportedProcessLocalTopology(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production') return;

  const raw = env.API_INSTANCE_COUNT;
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'API_INSTANCE_COUNT must be explicitly configured in production while rate limiting uses process-local storage',
    );
  }

  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      'API_INSTANCE_COUNT must be the canonical integer 1 while rate limiting uses process-local storage',
    );
  }

  const parsed = Number(normalized);
  if (
    !Number.isSafeInteger(parsed) ||
    normalized !== String(parsed) ||
    parsed !== SUPPORTED_PROCESS_LOCAL_API_INSTANCE_COUNT
  ) {
    throw new Error(
      'API_INSTANCE_COUNT must be 1 while rate limiting uses process-local storage; configure a validated shared or edge limiter before horizontal scaling',
    );
  }
}

export function createApiRateLimitPolicy(env: NodeJS.ProcessEnv = process.env) {
  const requireExplicit = env.NODE_ENV === 'production';
  assertSupportedProcessLocalTopology(env);
  return {
    ttl: parseBoundedInteger(
      env.API_RATE_LIMIT_TTL_MS,
      'API_RATE_LIMIT_TTL_MS',
      DEFAULT_API_RATE_LIMIT_TTL_MS,
      MIN_API_RATE_LIMIT_TTL_MS,
      MAX_API_RATE_LIMIT_TTL_MS,
      requireExplicit,
    ),
    limit: parseBoundedInteger(
      env.API_RATE_LIMIT_LIMIT,
      'API_RATE_LIMIT_LIMIT',
      DEFAULT_API_RATE_LIMIT_LIMIT,
      MIN_API_RATE_LIMIT_LIMIT,
      MAX_API_RATE_LIMIT_LIMIT,
      requireExplicit,
    ),
  };
}
