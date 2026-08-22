import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CORS_ALLOWED_ORIGINS_JSON must contain valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('CORS_ALLOWED_ORIGINS_JSON must be a JSON array.');
  }

  const origins = parsed.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error('CORS_ALLOWED_ORIGINS_JSON may contain only non-empty origin strings.');
    }

    const raw = item.trim();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Invalid CORS origin: ${raw}`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Unsupported CORS origin protocol: ${raw}`);
    }
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`CORS origin must not include credentials, a path, query, or fragment: ${raw}`);
    }

    return url.origin;
  });

  return [...new Set(origins)];
}

export function validateProductionCorsOrigins(origins: string[]): string[] {
  const errors: string[] = [];
  if (origins.length === 0) {
    errors.push('CORS_ALLOWED_ORIGINS_JSON must contain at least one production Web origin.');
  }

  for (const origin of origins) {
    const url = new URL(origin);
    if (url.protocol !== 'https:') {
      errors.push(`CORS origin must use HTTPS in production: ${origin}`);
    }
    if (LOCAL_HOSTS.has(url.hostname)) {
      errors.push(`CORS origin must not use a local host in production: ${origin}`);
    }
  }

  return errors;
}

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  if (env.NODE_ENV !== 'production') {
    return {
      origin: true,
      credentials: true,
      exposedHeaders: ['x-request-id', 'x-correlation-id'],
    };
  }

  const origins = parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS_JSON);
  const errors = validateProductionCorsOrigins(origins);
  if (errors.length > 0) {
    throw new Error(`Invalid production CORS configuration: ${errors.join(' ')}`);
  }

  const allowed = new Set(origins);
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowed.has(origin));
    },
    credentials: true,
    exposedHeaders: ['x-request-id', 'x-correlation-id'],
  };
}
