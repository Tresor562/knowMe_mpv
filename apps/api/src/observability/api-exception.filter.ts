import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { RequestContextService } from './request-context.service';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE'
};

type ErrorShape = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  error?: unknown;
};

type ErrorRequest = {
  requestId?: string;
  method: string;
  originalUrl?: string;
  url: string;
};

type ErrorResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ErrorResponse;
  json(body: unknown): void;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly context: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const response = http.getResponse<ErrorResponse>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : undefined;

    const parsed = this.parse(raw, status);
    const requestId =
      this.context.requestId ?? request.requestId ?? 'request-id-unavailable';

    response.setHeader('x-request-id', requestId);
    response.status(status).json({
      statusCode: status,
      code: parsed.code,
      message: parsed.message,
      details: parsed.details,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url
    });

    if (status >= 500) {
      const error = exception instanceof Error ? exception : undefined;
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'api.exception',
          requestId,
          method: request.method,
          path: request.originalUrl || request.url,
          code: parsed.code,
          errorName: error?.name,
          stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack
        })
      );
    }
  }

  private parse(raw: string | object | undefined, status: number) {
    const fallbackCode = STATUS_CODES[status] ?? `HTTP_${status}`;
    if (status >= 500) {
      return {
        code: fallbackCode,
        message: 'Une erreur interne est survenue.',
        details: null
      };
    }

    if (typeof raw === 'string') {
      return { code: fallbackCode, message: raw, details: null };
    }

    const shape = (raw ?? {}) as ErrorShape;
    const details = Array.isArray(shape.message)
      ? shape.message
      : shape.details ?? null;
    const message = Array.isArray(shape.message)
      ? 'La requête contient des données invalides.'
      : typeof shape.message === 'string'
        ? shape.message
        : typeof shape.error === 'string'
          ? shape.error
          : 'La requête ne peut pas être traitée.';

    return {
      code: typeof shape.code === 'string' ? shape.code : fallbackCode,
      message,
      details
    };
  }
}
