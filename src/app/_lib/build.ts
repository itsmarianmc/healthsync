// Injected into both the Next application and the generated worker at build time.
export const APP_BUILD_ID = process.env.NEXT_PUBLIC_HEALTHSYNC_BUILD_ID || 'development';
