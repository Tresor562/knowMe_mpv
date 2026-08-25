const BOUNDS = {
  API_REQUEST_TIMEOUT_MS: [5_000, 120_000],
  API_HEADERS_TIMEOUT_MS: [1_000, 60_000],
  API_KEEP_ALIVE_TIMEOUT_MS: [1_000, 30_000],
};

export function parseRequiredCanonicalInteger(env, name) {
  const raw = env[name]?.trim();
  if (!raw) throw new Error(`${name} is required for a market release.`);
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a canonical positive integer.`);

  const value = Number(raw);
  const [min, max] = BOUNDS[name];
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function validateHttpServerReleasePolicy(env = process.env) {
  const requestTimeoutMs = parseRequiredCanonicalInteger(env, 'API_REQUEST_TIMEOUT_MS');
  const headersTimeoutMs = parseRequiredCanonicalInteger(env, 'API_HEADERS_TIMEOUT_MS');
  const keepAliveTimeoutMs = parseRequiredCanonicalInteger(env, 'API_KEEP_ALIVE_TIMEOUT_MS');

  if (headersTimeoutMs > requestTimeoutMs) {
    throw new Error('API_HEADERS_TIMEOUT_MS must be less than or equal to API_REQUEST_TIMEOUT_MS.');
  }
  if (keepAliveTimeoutMs >= requestTimeoutMs) {
    throw new Error('API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_REQUEST_TIMEOUT_MS.');
  }

  return { requestTimeoutMs, headersTimeoutMs, keepAliveTimeoutMs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateHttpServerReleasePolicy(process.env);
    console.log('HTTP server release preflight passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'HTTP server release preflight failed.');
    process.exitCode = 1;
  }
}
