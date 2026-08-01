import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RequestContextService } from './request-context.service';

type AuthenticatedRequest = {
  user?: { userId?: string };
  method: string;
  originalUrl?: string;
  url: string;
};

type LoggingResponse = {
  statusCode: number;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly context: RequestContextService) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (executionContext.getType() !== 'http') return next.handle();

    const http = executionContext.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<LoggingResponse>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, startedAt, false),
        error: (error: unknown) =>
          this.log(request, response, startedAt, true, error)
      })
    );
  }

  private log(
    request: AuthenticatedRequest,
    response: LoggingResponse,
    startedAt: number,
    failed: boolean,
    error?: unknown
  ) {
    const store = this.context.get();
    const statusCode =
      error instanceof HttpException ? error.getStatus() : response.statusCode;
    const record = {
      level: failed ? 'warn' : 'info',
      event: 'http.request.completed',
      requestId: store?.requestId,
      correlationId: store?.correlationId,
      accountId: request.user?.userId,
      method: request.method,
      path: (request.originalUrl || request.url).split('?')[0],
      statusCode,
      durationMs: Date.now() - startedAt
    };

    const line = JSON.stringify(record);
    if (failed) console.warn(line);
    else console.log(line);
  }
}
