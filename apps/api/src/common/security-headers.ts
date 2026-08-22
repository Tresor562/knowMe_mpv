type HeaderResponse = {
  setHeader(name: string, value: string): unknown;
};

const BASE_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

const PRODUCTION_SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

export function createSecurityHeadersMiddleware(
  environment = process.env.NODE_ENV,
): (_request: unknown, response: HeaderResponse, next: () => void) => void {
  const headers =
    environment === 'production'
      ? { ...BASE_SECURITY_HEADERS, ...PRODUCTION_SECURITY_HEADERS }
      : BASE_SECURITY_HEADERS;

  return (_request, response, next) => {
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    next();
  };
}
