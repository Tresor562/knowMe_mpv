import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

const SAFE_TRACE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

type TracedRequest = Request & {
  requestId?: string;
  correlationId?: string;
};

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function trustedHeader(value: string | undefined, trusted: boolean) {
  if (!trusted || !value || !SAFE_TRACE_ID.test(value)) return undefined;
  return value;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: TracedRequest, res: Response, next: NextFunction) {
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
