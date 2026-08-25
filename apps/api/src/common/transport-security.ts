type TransportRequest = {
  secure?: boolean;
  path?: string;
  originalUrl?: string;
};

type TransportResponse = {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
};

const INTERNAL_HEALTH_PATHS = new Set(['/health', '/health/live', '/health/ready']);

function requestPath(request: TransportRequest): string {
  if (typeof request.path === 'string' && request.path) return request.path;
  const raw = typeof request.originalUrl === 'string' ? request.originalUrl : '';
  return raw.split('?', 1)[0] || '/';
}

export function createProductionHttpsGuard(
  environment = process.env.NODE_ENV,
): (request: TransportRequest, response: TransportResponse, next: () => void) => void {
  return (request, response, next) => {
    if (environment !== 'production' || request.secure === true || INTERNAL_HEALTH_PATHS.has(requestPath(request))) {
      next();
      return;
    }

    response.statusCode = 426;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({
      statusCode: 426,
      code: 'HTTPS_REQUIRED',
      message: 'HTTPS is required.',
    }));
  };
}
