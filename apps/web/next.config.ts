import type { NextConfig } from 'next';

// Em desenvolvimento, /api/* é encaminhado para a API (mesma origem para cookies).
// Em produção, o proxy (Caddy) faz esse papel e este rewrite não é usado.
const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return process.env.NODE_ENV === 'production' && !process.env.API_INTERNAL_URL
      ? []
      : [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
