import { createProductionHttpsGuard } from './transport-security';

describe('createProductionHttpsGuard', () => {
  function run(input: { environment?: string; secure?: boolean; path?: string; originalUrl?: string }) {
    let body = '';
    const headers = new Map<string, string>();
    const response = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      end(value?: string) {
        body = value ?? '';
      },
    };
    const next = jest.fn();

    createProductionHttpsGuard(input.environment)({
      secure: input.secure,
      path: input.path,
      originalUrl: input.originalUrl,
    }, response, next);

    return { response, headers, body, next };
  }

  it('does not enforce HTTPS outside production', () => {
    const result = run({ environment: 'test', secure: false, path: '/auth/login' });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.response.statusCode).toBe(200);
  });

  it('allows secure production API requests', () => {
    const result = run({ environment: 'production', secure: true, path: '/auth/login' });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.response.statusCode).toBe(200);
  });

  it('rejects cleartext production API requests without redirecting sensitive URLs', () => {
    const result = run({
      environment: 'production',
      secure: false,
      originalUrl: '/auth/recovery/reset?token=secret-token',
    });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.response.statusCode).toBe(426);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.headers.has('Location')).toBe(false);
    expect(result.body).toContain('HTTPS_REQUIRED');
    expect(result.body).not.toContain('secret-token');
  });

  it.each(['/health', '/health/live', '/health/ready'])(
    'keeps internal cleartext health probe %s available',
    (path) => {
      const result = run({ environment: 'production', secure: false, path });

      expect(result.next).toHaveBeenCalledTimes(1);
      expect(result.response.statusCode).toBe(200);
    },
  );

  it('does not exempt metrics from HTTPS enforcement', () => {
    const result = run({ environment: 'production', secure: false, path: '/health/metrics' });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.response.statusCode).toBe(426);
  });
});
