import { ensure } from '@campusloop/core';
export function loadConfig() {
    const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
    const url = new URL(origin);
    ensure(origin === url.origin, 500, 'CONFIG', 'APP_ORIGIN must be a bare origin, without a path or trailing slash.');
    if (process.env.NODE_ENV === 'production')
        ensure(url.protocol === 'https:', 500, 'CONFIG', 'Use an HTTPS APP_ORIGIN in production.');
    ensure(!!process.env.DATABASE_URL, 500, 'CONFIG', 'DATABASE_URL is required.');
    if (process.env.NODE_ENV === 'production')
        ensure(process.env.DEMO_MODE !== 'true', 500, 'CONFIG', 'Demo mode is forbidden in production.');
    return { origin, demo: process.env.DEMO_MODE === 'true', sessionDays: 7 };
}
