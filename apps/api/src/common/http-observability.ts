import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

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

export function resolveRequestId(value: HeaderValue, generate = randomUUID): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  return generate();
}

export function safeRequestPath(request: Pick<RequestLike, 'path' | 'url'>): string {
  if (typeof request.path === 'string' && request.path.startsWith('/')) return request.path;
  const raw = typeof request.url === 'string' ? request.url : '/';
  return raw.split('?', 1)[0] || '/';
}

export function createHttpObservabilityMiddleware(
  write: (entry: HttpRequestLog) => void = (entry) => console.log(JSON.stringify(entry)),
  now: () => number = Date.now
) {
  return (request: RequestLike, response: ResponseLike, next: Next) => {
    const requestId = resolveRequestId(request.headers?.['x-request-id']);
    const startedAt = now();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.once('finish', () => {
      write({
        event: 'http_request_completed',
        requestId,
        method: request.method ?? 'UNKNOWN',
        path: safeRequestPath(request),
        statusCode: response.statusCode,
        durationMs: Math.max(0, now() - startedAt)
      });
    });

    next();
  };
}
