import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const LATENCY_BUCKETS_MS = [100, 250, 500, 1000, 2500, 5000] as const;

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  method?: string;
  path?: string;
  url?: string;
  headers?: Record<string, HeaderValue>;
  requestId?: string;
};

type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: 'finish', listener: () => void): void;
};

type Next = () => void;

export type HttpRequestLog = {
  event: 'http_request_completed';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

export type RuntimeHttpMetricsSnapshot = {
  requests: {
    total: number;
    success2xx: number;
    clientError4xx: number;
    serverError5xx: number;
    other: number;
  };
  latencyMs: {
    count: number;
    sum: number;
    max: number;
    buckets: Record<string, number>;
  };
};

const runtimeMetrics = {
  total: 0,
  success2xx: 0,
  clientError4xx: 0,
  serverError5xx: 0,
  other: 0,
  latencyCount: 0,
  latencySum: 0,
  latencyMax: 0,
  latencyBuckets: new Map<number, number>(LATENCY_BUCKETS_MS.map((bucket) => [bucket, 0]))
};

export function resolveRequestId(value: HeaderValue, generate: () => string = randomUUID): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  return generate();
}

export function safeRequestPath(request: Pick<RequestLike, 'path' | 'url'>): string {
  if (typeof request.path === 'string' && request.path.startsWith('/')) return request.path;
  const raw = typeof request.url === 'string' ? request.url : '/';
  return raw.split('?', 1)[0] || '/';
}

export function recordRuntimeHttpMetric(statusCode: number, durationMs: number): void {
  runtimeMetrics.total += 1;
  if (statusCode >= 200 && statusCode < 300) runtimeMetrics.success2xx += 1;
  else if (statusCode >= 400 && statusCode < 500) runtimeMetrics.clientError4xx += 1;
  else if (statusCode >= 500 && statusCode < 600) runtimeMetrics.serverError5xx += 1;
  else runtimeMetrics.other += 1;

  const safeDuration = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
  runtimeMetrics.latencyCount += 1;
  runtimeMetrics.latencySum += safeDuration;
  runtimeMetrics.latencyMax = Math.max(runtimeMetrics.latencyMax, safeDuration);
  for (const bucket of LATENCY_BUCKETS_MS) {
    if (safeDuration <= bucket) {
      runtimeMetrics.latencyBuckets.set(bucket, (runtimeMetrics.latencyBuckets.get(bucket) ?? 0) + 1);
    }
  }
}

export function getRuntimeHttpMetricsSnapshot(): RuntimeHttpMetricsSnapshot {
  return {
    requests: {
      total: runtimeMetrics.total,
      success2xx: runtimeMetrics.success2xx,
      clientError4xx: runtimeMetrics.clientError4xx,
      serverError5xx: runtimeMetrics.serverError5xx,
      other: runtimeMetrics.other
    },
    latencyMs: {
      count: runtimeMetrics.latencyCount,
      sum: runtimeMetrics.latencySum,
      max: runtimeMetrics.latencyMax,
      buckets: Object.fromEntries(
        LATENCY_BUCKETS_MS.map((bucket) => [`le_${bucket}`, runtimeMetrics.latencyBuckets.get(bucket) ?? 0])
      )
    }
  };
}

export function resetRuntimeHttpMetricsForTests(): void {
  runtimeMetrics.total = 0;
  runtimeMetrics.success2xx = 0;
  runtimeMetrics.clientError4xx = 0;
  runtimeMetrics.serverError5xx = 0;
  runtimeMetrics.other = 0;
  runtimeMetrics.latencyCount = 0;
  runtimeMetrics.latencySum = 0;
  runtimeMetrics.latencyMax = 0;
  for (const bucket of LATENCY_BUCKETS_MS) runtimeMetrics.latencyBuckets.set(bucket, 0);
}

export function createHttpObservabilityMiddleware(
  write: (entry: HttpRequestLog) => void = (entry) => console.log(JSON.stringify(entry)),
  now: () => number = Date.now,
  observe: (statusCode: number, durationMs: number) => void = recordRuntimeHttpMetric
) {
  return (request: RequestLike, response: ResponseLike, next: Next) => {
    const requestId = resolveRequestId(request.headers?.['x-request-id']);
    const startedAt = now();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.once('finish', () => {
      const durationMs = Math.max(0, now() - startedAt);
      write({
        event: 'http_request_completed',
        requestId,
        method: request.method ?? 'UNKNOWN',
        path: safeRequestPath(request),
        statusCode: response.statusCode,
        durationMs
      });
      observe(response.statusCode, durationMs);
    });

    next();
  };
}
