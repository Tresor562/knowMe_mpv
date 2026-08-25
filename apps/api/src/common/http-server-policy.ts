type HttpServerLike = {
  requestTimeout: number;
  headersTimeout: number;
  keepAliveTimeout: number;
};

export type HttpServerTimeoutPolicy = {
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  keepAliveTimeoutMs: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 15_000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 5_000;

function parseCanonicalBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
  required: boolean,
): number {
  const normalized = value?.trim();
  if (!normalized) {
    if (required) throw new Error(`${name} is required in production.`);
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${name} must be a canonical positive integer.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

export function resolveHttpServerTimeoutPolicy(
  env: NodeJS.ProcessEnv = process.env,
): HttpServerTimeoutPolicy {
  const production = env.NODE_ENV === 'production';
  const requestTimeoutMs = parseCanonicalBoundedInteger(
    env.API_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    5_000,
    120_000,
    'API_REQUEST_TIMEOUT_MS',
    production,
  );
  const headersTimeoutMs = parseCanonicalBoundedInteger(
    env.API_HEADERS_TIMEOUT_MS,
    DEFAULT_HEADERS_TIMEOUT_MS,
    1_000,
    60_000,
    'API_HEADERS_TIMEOUT_MS',
    production,
  );
  const keepAliveTimeoutMs = parseCanonicalBoundedInteger(
    env.API_KEEP_ALIVE_TIMEOUT_MS,
    DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
    1_000,
    30_000,
    'API_KEEP_ALIVE_TIMEOUT_MS',
    production,
  );

  if (headersTimeoutMs > requestTimeoutMs) {
    throw new Error('API_HEADERS_TIMEOUT_MS must be less than or equal to API_REQUEST_TIMEOUT_MS.');
  }
  if (keepAliveTimeoutMs >= requestTimeoutMs) {
    throw new Error('API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_REQUEST_TIMEOUT_MS.');
  }

  return { requestTimeoutMs, headersTimeoutMs, keepAliveTimeoutMs };
}

export function applyHttpServerTimeoutPolicy(
  server: HttpServerLike,
  policy = resolveHttpServerTimeoutPolicy(),
): void {
  server.requestTimeout = policy.requestTimeoutMs;
  server.headersTimeout = policy.headersTimeoutMs;
  server.keepAliveTimeout = policy.keepAliveTimeoutMs;
}
