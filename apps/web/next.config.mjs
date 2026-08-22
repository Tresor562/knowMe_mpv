function resolvePublicApiSources() {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return [];

  try {
    const url = new URL(raw);
    const sources = [url.origin];
    if (url.protocol === 'https:') sources.push(`wss://${url.host}`);
    if (url.protocol === 'http:') sources.push(`ws://${url.host}`);
    return sources;
  } catch {
    return [];
  }
}

function buildContentSecurityPolicy() {
  const apiSources = resolvePublicApiSources();
  const connectSources = ["'self'", ...apiSources].join(' ');
  const mediaSources = ["'self'", 'blob:', ...apiSources].join(' ');
  const imageSources = ["'self'", 'data:', 'blob:', ...apiSources].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources}`,
    `media-src ${mediaSources}`,
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ].join('; ');
}

const baseSecurityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

const productionOnlyHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy()
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers:
          process.env.NODE_ENV === 'production'
            ? [...baseSecurityHeaders, ...productionOnlyHeaders]
            : baseSecurityHeaders
      }
    ];
  }
};

export default nextConfig;
