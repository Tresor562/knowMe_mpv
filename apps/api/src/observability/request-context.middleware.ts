import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from './request-context.service';

const SAFE_TRACE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

type HeaderValue = string | string[] | undefined;

type TracedRequest = {
  headers: Record<string, HeaderValue>;
  ip?: string;
  socket: { remoteAddress?: string };
  requestId?: string;
  correlationId?: string;
};

type TraceResponse = {
  setHeader(name: string, value: string): void;
};

type Next = () => void;

function firstHeader(value: HeaderValue) {
  return Array.isArray(value) ? value[0] : value;
}

function trustedHeader(value: string | undefined, trusted: boolean) {
  if (!trusted || !value || !SAFE_TRACE_ID.test(value)) return undefined;
  return value;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: TracedRequest, res: TraceResponse, next: Next) {
    const trustIncoming = process.env.TRUST_REQUEST_ID_HEADER === 'true';
    const suppliedRequestId = trustedHeader(
      firstHeader(req.headers['x-request-id']),
      trustIncoming
    );
    const suppliedCorrelationId = trustedHeader(
      firstHeader(req.headers['x-correlation-id']),
      trustIncoming
    );

    const requestId = suppliedRequestId ?? randomUUID();
    const correlationId = suppliedCorrelationId ?? requestId;
    const userAgent = firstHeader(req.headers['user-agent'])?.slice(0, 500);
    const ipAddress = (req.ip || req.socket.remoteAddress || '').slice(0, 128) || undefined;

    req.requestId = requestId;
    req.correlationId = correlationId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    this.context.run(
      {
        requestId,
        correlationId,
        startedAt: Date.now(),
        ipAddress,
        userAgent
      },
      next
    );
  }
}
