import { createSecurityHeadersMiddleware } from './security-headers';

describe('createSecurityHeadersMiddleware', () => {
  function run(environment?: string) {
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    const next = jest.fn();

    createSecurityHeadersMiddleware(environment)({}, response, next);

    return { headers, next };
  }

  it('sets privacy-safe baseline headers and continues the request', () => {
    const { headers, next } = run('test');

    expect(headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-DNS-Prefetch-Control')).toBe('off');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.has('Strict-Transport-Security')).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('adds HSTS only for production responses', () => {
    const { headers } = run('production');

    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('never reflects request data into security headers', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    const next = jest.fn();
    const attackerControlledRequest = {
      url: '/reset?token=secret-token',
      headers: { authorization: 'Bearer secret-token' },
    };

    createSecurityHeadersMiddleware('production')(
      attackerControlledRequest,
      response,
      next,
    );

    const serialized = JSON.stringify(Object.fromEntries(headers));
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('/reset');
  });
});
