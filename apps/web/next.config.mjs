const baseSecurityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

const productionOnlyHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
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
