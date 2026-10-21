import type { NextConfig } from 'next';
const upstream = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
// Fixed upstream, never derived from request headers or user input.
if (!/^https?:\/\/[A-Za-z0-9.\-:\[\]]+$/.test(upstream))
    throw new Error('API_INTERNAL_URL must be a fixed HTTP origin.');
const config: NextConfig = {
    reactStrictMode: true, poweredByHeader: false,
    async rewrites() { return [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }]; },
    async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'same-origin' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' }] }]; }
};
export default config;
