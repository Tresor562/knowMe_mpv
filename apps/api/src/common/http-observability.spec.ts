import {
  createHttpObservabilityMiddleware,
  resolveRequestId,
  safeRequestPath,
  type HttpRequestLog
} from './http-observability';

describe('http observability', () => {
  it('accepts a bounded safe request id and regenerates invalid values', () => {
    expect(resolveRequestId('req-123', () => 'generated')).toBe('req-123');
    expect(resolveRequestId('contains spaces', () => 'generated')).toBe('generated');
    expect(resolveRequestId('x'.repeat(129), () => 'generated')).toBe('generated');
  });

  it('never includes the query string in the logged path', () => {
    expect(safeRequestPath({ url: '/auth/reset?token=super-secret' })).toBe('/auth/reset');
    expect(safeRequestPath({ path: '/account/export', url: '/account/export?code=1234' })).toBe(
      '/account/export'
    );
  });

  it('emits one privacy-safe completion log and returns the request id', () => {
    const logs: HttpRequestLog[] = [];
    const listeners = new Map<string, () => void>();
    const responseHeaders = new Map<string, string>();
    const request = {
      method: 'POST',
      url: '/auth/login?password=do-not-log',
      headers: {
        'x-request-id': 'client-42',
        authorization: 'Bearer secret'
      } as Record<string, string>
    };
    const response = {
      statusCode: 201,
      setHeader(name: string, value: string) {
        responseHeaders.set(name, value);
      },
      once(event: 'finish', listener: () => void) {
        listeners.set(event, listener);
      }
    };
    const times = [100, 137];
    const next = jest.fn();

    createHttpObservabilityMiddleware((entry) => logs.push(entry), () => times.shift() ?? 137)(
      request,
      response,
      next
    );
    listeners.get('finish')?.();

    expect(next).toHaveBeenCalledTimes(1);
    expect(responseHeaders.get('x-request-id')).toBe('client-42');
    expect(logs).toEqual([
      {
        event: 'http_request_completed',
        requestId: 'client-42',
        method: 'POST',
        path: '/auth/login',
        statusCode: 201,
        durationMs: 37
      }
    ]);
    expect(JSON.stringify(logs)).not.toContain('password');
    expect(JSON.stringify(logs)).not.toContain('Bearer secret');
    expect(JSON.stringify(logs)).not.toContain('do-not-log');
  });
});
