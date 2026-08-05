import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Content-Security-Policy. The unsafe-* directives are kept because the app
// renders inline scripts (splash screen, Google Analytics) and loads a
// third-party barcode library over the network. To remove them later, migrate
// the inline scripts to nonces and bundle @zxing/browser via npm.
const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://static.itsmarian.dev",
    "img-src 'self' blob: data: https:",
    "font-src 'self' https://static.itsmarian.dev",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.itsmarian.dev https://generativelanguage.googleapis.com https://world.openfoodfacts.org https://nominatim.openstreetmap.org https://www.google-analytics.com https://*.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
].join(' ');

export function proxy(_request: NextRequest) {
    const response = NextResponse.next();

    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Permissions-Policy',
        'geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=(self), magnetometer=(self), gyroscope=(self)'
    );

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
