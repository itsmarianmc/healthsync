import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://static.itsmarian.dev",
  "font-src 'self' https://static.itsmarian.dev",
  "img-src 'self' blob: data: https:",
  "connect-src 'self' https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=(self), magnetometer=(self), gyroscope=(self), accelerometer=(self)'
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};