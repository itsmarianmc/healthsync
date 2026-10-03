# Operations, Development and Testing

## Requirements

- Node.js with a compatible npm version
- dependencies installed from `package-lock.json`
- a Supabase project and `.env.example` values for cloud features
- Microsoft Edge at the configured Playwright path, or an adjusted Playwright configuration, for local E2E

## Local setup

```bash
npm install
cp .env.example .env
# edit .env
npm run dev
```

Default URL: `http://localhost:3000`.

### Environment variables

| Variable | Required | Use |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | for Auth/cloud | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for Auth/cloud | publishable/anon key in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | account-delete API | server-side only |
| `NEXT_PUBLIC_GA_ID` | no | Analytics measurement ID; code has a fallback |
| `GEMINI_API_KEY` | not required by current client flow | UI primarily uses the user-provided local key |
| `BASE_URL` | Playwright/links | base URL, default `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_URL` | no | sitemap base, with production fallback |

`.env` is ignored by `.gitignore`. Never copy values from it into documentation, logs or client code.

## Actual npm scripts

`package.json` defines `dev`, `build`, `start`, `lint`, `test`, `test:watch` and `test:e2e`:

```bash
npm test
npm run test:watch
npm run test:e2e
npx playwright test e2e/settings.spec.ts
npx playwright test --ui
```

## Playwright configuration

`playwright.config.ts` uses `e2e/` as the test directory, calls `/dash`, `/food`, `/drinks`, `/login` and `/onboarding` in global setup, and uses `BASE_URL` or `http://localhost:3000`. In CI it starts `npm run build && npm run start` as the web server, with one worker and two retries. Locally it uses a Desktop Edge project with a fixed executable path.

The current GitHub Action is disabled with `if: false`. A locally green E2E run therefore does not mean that CI is currently executing the tests.

## Build and verification order

```bash
git diff --check
npm run lint
npm run build
npx playwright test
```

For UI/data changes also check manually:

1. `/onboarding` in a fresh browser profile.
2. direct `/dash`, `/food` and `/drinks` navigation.
3. food/drink write, reload and day filtering.
4. Settings change and Local Storage event.
5. Login, MFA and cloud sync when Supabase is configured.
6. offline navigation after Service Worker installation.

## Deployment

```bash
npm ci
npm run build
npm run start
```

For Vercel, set environment variables in project settings. For a self-managed Node host, put the server behind TLS/reverse proxy; the host may set `PORT`. `hosting.md` contains Supabase SQL, a Docker example, backup notes and a SQLite porting outline (not a currently wired backend).

## Supabase operations

1. Create or clone the project intended for development/testing.
2. Treat the SQL in `hosting.md` as a table-shape reference only. It enables
   RLS without defining policies and is not a complete setup procedure.
3. Review the actual schema, policies, grants and constraints using
   [`security-migration.md`](./security-migration.md). This checkout contains
   only the additive newsletter preference migration; it does not contain the
   base schema or security migration chain described in older audit notes.
4. Do not assume that the historical reports of a clone migration establish
   the state of another project or the current remote schema.
5. Verify each app-level acceptance case in `security-migration.md` using
   disposable users, especially cross-account access, AAL1/AAL2, sync after
   reload, Delete All Data and account deletion.
6. Only after a target-project preflight and backup, apply the migration to the
   intended production database and deploy the matching app release. Production
   migration/deployment is not confirmed by the repository or the test-clone
   result.
7. Restrict Auth redirect URLs and Site URL to controlled origins; configure
   email confirmation, password rules and optional TOTP/MFA.

The `updated_at` trigger on `user_settings` is important because workout routines are merged by timestamp.

## PWA and offline behavior

- `public/manifest.json` defines name, icons, standalone mode, start URL and shortcuts.
- `src/app/layout.tsx` uses the default iOS status-bar style and a fixed 1px theme-colored background to mitigate status-bar blur without extra padding. Verify on an actual iOS Home Screen app; re-adding the app may be needed to refresh the installed metadata, so export local tracking data before removing it.
- `src/app/sw.ts` uses Serwist precaching and runtime caching.
- Navigation failures serve `public/offline.html`.
- The Service Worker is registered through the generated Serwist route.
- Local Storage remains the operational data source while offline.

Offline does not make external features available: Open Food Facts, Gemini, weather, support and Supabase require network access. The UI should translate those dependencies into error states.

## Security headers and CSP

[proxy.ts](../src/proxy.ts) sets Content-Security-Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a Permissions Policy for geolocation, camera, microphone and sensors.

When adding an external host, update `connect-src`, `img-src`, `script-src` or `style-src` narrowly. Do not add a global wildcard.

## Troubleshooting

### Supabase sync does not work

- Search the browser console for `[sync]`.
- Check `NEXT_PUBLIC_SUPABASE_URL` and the anon key.
- Check `/api/sync/verify` with a valid session.
- Compare tables and constraints with `hosting.md`; compare policies and grants
  with `docs/security-migration.md`. Verify the CLI is linked to the intended
  project before any dump or migration command.
- Restart the dev server after changing `.env`.

### AI does not work

- Check `calsync_ai_enabled`, terms, `cookieSettings.thirdparty` and the key.
- Validate the key again in Settings.
- Check the Gemini HTTP status and normalized error.
- Do not assume a server-side `GEMINI_API_KEY` proxy; current code calls Gemini directly from the browser.

### Camera does not work

- Use HTTPS or localhost.
- Check camera permission.
- Check the `@zxing/browser` script and CSP.
- Check `navigator.mediaDevices.getUserMedia` and available video devices.
- Keep manual barcode entry as a fallback.

### Weather does not work

- Check preferences and third-party consent.
- Check geolocation permission.
- Check stored `healthsync_weather_*` values.
- Check Nominatim and Open-Meteo reachability.

### Test/build problems

- Use `npm ci` for lockfile/install discrepancies.
- Fix `npm run lint` findings before build.
- Do not call browser-only APIs during SSR.
- For route 404s, verify the file is under `src/app/<route>/page.tsx` and whether AppShell intentionally treats the route as a main-app path.

## Backups and portability

- Use Supabase backups or `pg_dump` as described in `hosting.md`.
- Use the local Settings export for user export.
- A GDPR-oriented rebuild should add a server-side portability/export feature; the current default is primarily local.

