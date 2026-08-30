import { createCorsOptions, parseCorsAllowedOrigins, validateProductionCorsOrigins } from './cors-policy';

function evaluateOrigin(options: ReturnType<typeof createCorsOptions>, origin?: string) {
  const handler = options.origin;
  if (typeof handler !== 'function') throw new Error('Expected a CORS origin callback.');

  return new Promise<boolean>((resolve, reject) => {
    handler(origin ?? '', (error, allowed) => {
      if (error) reject(error);
      else resolve(Boolean(allowed));
    });
  });
}

describe('production CORS policy', () => {
  it('normalizes and deduplicates exact origins', () => {
    expect(
      parseCorsAllowedOrigins(JSON.stringify(['https://knowme.example', 'https://knowme.example/'])),
    ).toEqual(['https://knowme.example']);
  });

  it('rejects malformed, path-bearing, credentialed and unsupported origins', () => {
    expect(() => parseCorsAllowedOrigins('[invalid')).toThrow('valid JSON');
    expect(() => parseCorsAllowedOrigins(JSON.stringify(['https://knowme.example/app']))).toThrow('path');
    expect(() => parseCorsAllowedOrigins(JSON.stringify(['https://u:p@knowme.example']))).toThrow('credentials');
    expect(() => parseCorsAllowedOrigins(JSON.stringify(['file:///tmp/knowme']))).toThrow('protocol');
  });

  it('requires HTTPS non-local origins in production', () => {
    expect(validateProductionCorsOrigins([])).toContain(
      'CORS_ALLOWED_ORIGINS_JSON must contain at least one production Web origin.',
    );
    expect(validateProductionCorsOrigins(['http://knowme.example'])).toContain(
      'CORS origin must use HTTPS in production: http://knowme.example',
    );
    expect(validateProductionCorsOrigins(['https://localhost:3000'])).toContain(
      'CORS origin must not use a local host in production: https://localhost:3000',
    );
  });

  it('allows only configured browser origins while keeping non-browser requests possible', async () => {
    const options = createCorsOptions({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS_JSON: JSON.stringify(['https://knowme.example']),
    });

    await expect(evaluateOrigin(options, 'https://knowme.example')).resolves.toBe(true);
    await expect(evaluateOrigin(options, 'https://evil.example')).resolves.toBe(false);
    await expect(evaluateOrigin(options, undefined)).resolves.toBe(true);
    expect(options.credentials).toBe(true);
  });

  it('fails closed when a production allowlist is missing', () => {
    expect(() => createCorsOptions({ NODE_ENV: 'production' })).toThrow('Invalid production CORS configuration');
  });

  it('preserves permissive local development behavior only outside production', () => {
    expect(createCorsOptions({ NODE_ENV: 'development' }).origin).toBe(true);
  });
});
