import {
  createHttpObservabilityMiddleware,
  getRuntimeHttpMetricsSnapshot,
  recordRuntimeHttpMetric,
  resetRuntimeHttpMetricsForTests,
  resolveRequestId,
  safeRequestPath,
  type HttpRequestLog
} from './http-observability';

describe('http observability', () => {
  beforeEach(() => resetRuntimeHttpMetricsForTests());

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
    const observe = jest.fn();

    createHttpObservabilityMiddleware(
      (entry) => logs.push(entry),
      () => times.shift() ?? 137,
      observe
    )(request, response, next);
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
    expect(observe).toHaveBeenCalledWith(201, 37);
    expect(JSON.stringify(logs)).not.toContain('password');
    expect(JSON.stringify(logs)).not.toContain('Bearer secret');
    expect(JSON.stringify(logs)).not.toContain('do-not-log');
  });

  it('keeps aggregate metrics low-cardinality and free of request identity', () => {
    recordRuntimeHttpMetric(200, 75);
    recordRuntimeHttpMetric(404, 275);
    recordRuntimeHttpMetric(503, 1600);
    recordRuntimeHttpMetric(101, 5);

    const snapshot = getRuntimeHttpMetricsSnapshot();

    expect(snapshot.requests).toEqual({
      total: 4,
      success2xx: 1,
      clientError4xx: 1,
      serverError5xx: 1,
      other: 1
    });
    expect(snapshot.latencyMs).toMatchObject({ count: 4, sum: 1955, max: 1600 });
    expect(snapshot.latencyMs.buckets).toEqual({
      le_100: 2,
      le_250: 2,
      le_500: 3,
      le_1000: 3,
      le_2500: 4,
      le_5000: 4
    });
    expect(JSON.stringify(snapshot)).not.toContain('path');
    expect(JSON.stringify(snapshot)).not.toContain('requestId');
    expect(JSON.stringify(snapshot)).not.toContain('method');
  });

  it('sanitizes non-finite and negative durations before aggregation', () => {
    recordRuntimeHttpMetric(200, Number.POSITIVE_INFINITY);
    recordRuntimeHttpMetric(200, -20);

    expect(getRuntimeHttpMetricsSnapshot().latencyMs).toMatchObject({
      count: 2,
      sum: 0,
      max: 0
    });
  });
});
