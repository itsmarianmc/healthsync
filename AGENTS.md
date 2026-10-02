# HealthSync — Repository Guide for Agents

This file is the canonical, concise orientation for any coding agent working in this repository. The code and configuration are authoritative when they differ from prose. The detailed technical references are indexed in [`docs/README.md`](docs/README.md).

## Project at a glance

HealthSync is a mobile-first Next.js 16 Progressive Web App for food and macro tracking (CalSync), hydration (DropSync), workouts, and personal health settings. Its UI reads and writes browser-local data first so guest use and offline tracking continue without an account. Signed-in users can optionally synchronize that data with Supabase Auth and PostgreSQL. Gemini nutrition detection is opt-in and calls Google directly from the browser with the user's own key.

```text
Next App Router + React
  ├─ route pages and shared AppShell
  ├─ local-first feature state in browser Local Storage
  ├─ Supabase Auth cookies + owner-scoped PostgreSQL sync
  └─ consent- and capability-gated external services
```

## Start here

1. Read this guide, then [`docs/README.md`](docs/README.md) and [`docs/agent-guide.md`](docs/agent-guide.md).
2. Read the relevant architecture, feature, data, routing, and operations pages linked from the docs index.
3. Inspect the current source and configuration before relying on a claim in older prose.
4. Check `git status --short` before editing. Existing user changes are intentional workspace state: preserve them and do not reset, clean, stash, or overwrite them.

`CLAUDE.md` is kept as a compatibility pointer to this file so Claude-style agents use the same project guide rather than a stale copy.

## Repository map

| Path | Responsibility |
|---|---|
| `src/app/` | Next App Router pages, route handlers, styles, Service Worker |
| `src/app/_components/` | Dashboard, CalSync, DropSync, settings/workouts, navigation, shared UI |
| `src/app/_context/` | Auth, app-shell and AI-detection contexts |
| `src/app/_hooks/` | Local Storage, dashboard, onboarding, sheets and pending food drafts |
| `src/app/_lib/` | Domain types, local workspace/data, sync, auth policy, analytics and integrations |
| `src/app/api/` | Session verification and account deletion routes |
| `src/proxy.ts` | CSP and security response headers |
| `supabase/migrations/` | Versioned SQL migrations; read the migration runbook before changing or applying them |
| `tests/` | Node.js unit tests for local data/policy logic |
| `e2e/` | Playwright browser tests and global setup |
| `public/` | PWA assets, exercise catalogue, offline page and changelog |
| `docs/` | Current technical guide, audits, operational notes and file index |
| `README.md`, `hosting.md` | Public overview and deployment/Supabase setup |

## Runtime and data flow

- `src/app/layout.tsx` wraps the app in Auth and AppShell providers. `AppShell` adds shared navigation and global sheets/modals to the main app routes.
- The main views are distinct routes: `/dash`, `/food`, and `/drinks`. `/` redirects to `/dash`; `/login`, `/onboarding`, `/support`, and `/legal/*` have dedicated route flows.
- Feature data is partitioned in Local Storage by guest or active user through `src/app/_lib/localData.ts`. The local workspace remains the UI source of truth while offline.
- Signed-in cloud sync is coordinated by `src/app/_context/AuthContext.tsx` and `src/app/_lib/sync.ts`. A failed cloud operation must not erase local work or be mistaken for a successful empty cloud response.
- Auth sessions use the Supabase SSR browser client and cookies. Do not move session tokens or health data into new storage without an explicit design and migration.
- Workout routines live in `user_settings`; completed workout sessions live in `workout_sessions` and are keyed by `(user_id, session_id)`. Food and drinks use `(user_id, entry_id)`.

## Non-negotiable invariants

1. Keep guest tracking local and functional; cloud availability is optional for the core app.
2. Keep each guest/user workspace isolated. Account switching must never expose or silently merge another identity's local queue. Guest import is an explicit user action.
3. Owner-scope every health-data database operation. Database RLS is the enforcement boundary; UI checks are not a substitute.
4. A user with a verified TOTP factor must reach AAL2 before protected database or server-side account operations proceed. Accounts without a verified factor can use their own data at AAL1.
5. Keep writes retryable: pending local records survive network/auth failure; use idempotent upserts and the documented deletion/reset markers.
6. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is currently used only by `src/app/api/account/delete/route.ts`. Never put its value in a `NEXT_PUBLIC_*` variable, a browser bundle, documentation, command output, or test fixtures.
7. Local entry dates use `new Date().toDateString()`; timestamps (`ts`) are milliseconds. Changing either format requires a compatibility migration.
8. Food/drink client `id` maps to database `entry_id`; do not confuse it with the database UUID primary key.
9. Keep AI drafts separate from saved food entries. Gemini is a browser-to-Google request and its user key is stored locally, not in a server secret store.
10. Preserve consent and browser-capability checks for analytics, camera, location and third-party services. Update CSP narrowly when a host changes.
11. Keep URLs, query parameters, DOM IDs, Local Storage keys and custom events stable unless the related consumer/tests/docs are changed too.

## Security and migration status

The ordered migrations under `supabase/migrations/` create the base schema, apply owner/MFA policies and grants, add sync/reset fields and unique indexes, and create the `clear_healthsync_data()` RPC. The security migration replaces existing policies on five public tables, so inspect the target database first. See [`docs/security-migration.md`](docs/security-migration.md) for the CLI command, preflight queries, test matrix, backup and rollout steps.

As of 2026-10-02, the maintainer reports matching local and remote migration history, a read-only production SQL check with correct tested owner/AAL visibility on all five app tables, successful SQL write cases and an allowed `clear_healthsync_data()` reset, plus a passing current E2E suite and production build. The reported write/reset matrix and E2E count were not included in the handoff and were not independently repeated here. The updated unit suite and any remaining owner/MFA acceptance cases still need explicit evidence; see the migration guide.

## Common change locations

| Change | First files to inspect |
|---|---|
| Dashboard calculations | `src/app/_hooks/useDashboardData.ts`, `src/app/_components/dashboard/` |
| Food flow | `src/app/_components/calsync/`, `src/app/_lib/types.ts`, `src/app/_lib/localData.ts`, `src/app/_lib/sync.ts` |
| Drink flow | `src/app/_components/dropsync/`, `src/app/_lib/types.ts`, `src/app/_lib/localData.ts`, `src/app/_lib/sync.ts` |
| Workouts | `src/app/_components/settings/Workout*.tsx`, `src/app/_lib/types.ts`, `src/app/_lib/sync.ts` |
| Auth/MFA/account | `src/app/login/page.tsx`, `src/app/_context/AuthContext.tsx`, `src/app/_lib/mfaPolicy.ts`, `src/app/_lib/serverAuthorization.ts`, `src/app/api/` |
| Supabase schema or policies | `supabase/migrations/`, `hosting.md`, `docs/security-migration.md`, `docs/data-model-and-storage.md` |
| New route/URL behavior | `src/app/<route>/`, `src/app/_components/AppShell.tsx`, `src/app/sitemap.ts`, `docs/routing-and-contracts.md` |
| External integration | relevant `src/app/_lib/` or component, `src/proxy.ts`, consent hooks and `docs/routing-and-contracts.md` |
| PWA/update behavior | `src/app/sw.ts`, `src/app/serwist/[path]/route.ts`, `public/manifest.json`, `UpdateCenter.tsx`, `public/changelog.json` |

## Commands

```bash
npm ci
npm run dev
npm test                 # Node.js test runner
npm run test:watch
npm run test:e2e         # Playwright; local config expects Microsoft Edge
npm run lint
npx tsc --noEmit
npm run build
```

The Playwright config uses `BASE_URL` or `http://localhost:3000`; in local mode it reuses a running server and expects Edge at its configured Windows path. `.github/workflows/playwright.yml` currently has `if: false`, so GitHub Actions does not run that job. Do not claim CI coverage from local results.

For an implementation change, run the relevant checks and report exactly what ran and what did not. For a documentation-only change, do not run the application test suite unless the user asks for verification; check changed links/claims against source and report any commands not run.

## Documentation rules

- Update the relevant technical document in the same change as new routes, events, storage keys, database fields, sync behavior, integrations or operational requirements.
- Use `docs/README.md` as the documentation index and `docs/file-inventory.md` for concrete source lookup.
- `README.md` is the user-facing project summary. `hosting.md` is the actual Supabase and deployment setup guide. `FUNCTIONALITY.md` is historical/reference material and may describe the former vanilla-JS app; defer to current `src/` and `docs/` where they differ.
- Keep `docs/security-migration.md`: it is the operational runbook for a destructive-policy replacement and production rollout. Keep `docs/quality-audit.md` only as a dated evidence/status record; update or retire claims when new results arrive.
- Never call the app legally compliant or assert production database/deployment state without direct, current evidence.
