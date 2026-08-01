import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { RequestContextService } from './request-context.service';

type AuthenticatedRequest = Request & {
  user?: { userId?: string };
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly context: RequestContextService) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (executionContext.getType() !== 'http') return next.handle();

    const http = executionContext.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, startedAt, false),
        error: () => this.log(request, response, startedAt, true)
      })
    );
  }

  private log(
    request: AuthenticatedRequest,
    response: Response,
    startedAt: number,
    failed: boolean
  ) {
    const store = this.context.get();
    const record = {
      level: failed ? 'warn' : 'info',
      event: 'http.request.completed',
      requestId: store?.requestId,
      correlationId: store?.correlationId,
      accountId: request.user?.userId,
      method: request.method,
      path: (request.originalUrl || request.url).split('?')[0],
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt
    };

    const line = JSON.stringify(record);
    if (failed) console.warn(line);
    else console.log(line);
  }
}
