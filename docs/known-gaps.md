# Known Gaps and Technical Notes

This file deliberately records places where the current implementation, older documents and the ideal target architecture do not fully match. It prevents agents from treating an outdated description as a current contract.

## Outdated or divergent documentation

### `FUNCTIONALITY.md`

It contains valuable domain information but partly describes the former Vanilla-JS/monolithic structure. Statements such as “the three sections are only React state in `page.tsx`” no longer match the current route structure: `/dash`, `/food` and `/drinks` are separate Next pages. `src/app/page.tsx` only redirects to `/dash`.

### Weather proxy

Older documents mention a weather proxy. The current [WeatherWidget.tsx](../src/app/_components/dashboard/WeatherWidget.tsx) calls Open-Meteo directly; [location.ts](../src/app/_lib/location.ts) calls Nominatim directly. There is no matching Next API proxy in this repository.

### Test scripts

`package.json` now provides `test` and `test:watch` for the Node test suite and `test:e2e` for Playwright. Database policy integration still requires a local or isolated Supabase project.

## Data and sync risks

### Water goal on first cloud settings insert — client behavior corrected; database behavior unverified

The UI and client initial settings insert use a 2500 ml default. A numeric zero is preserved as an explicit goal value. The reset RPC implementation/migration is absent from this checkout, so its default behavior cannot be confirmed here.

### Macro goals with value 0 — fixed

Cloud values of zero are written locally and treated as an explicit disabled goal.

### Food/drink idempotent upserts — implemented in client; target constraints unverified

Food and drinks use client upserts with `(user_id, entry_id)`; offline writes remain pending until acknowledged. The matching database unique constraints are expected by the client but are not created by the migration present in this checkout.

### Workout history across devices — sync implemented; target constraints unverified

Completed sessions upload idempotently and are pulled from `workout_sessions` during normal authenticated sync. The client uses `(user_id, session_id)` as its upsert key. The matching database unique constraint is not created by the migration present in this checkout.

### Types versus UI session objects

`_lib/types.ts` describes `WorkoutSet` with `done` and `WorkoutSessionExercise` with `exerciseName`. `WorkoutModal.tsx` additionally uses UI fields such as `state`, `activeStartTime`, `completedAt`, `isPR` and a local `name` structure. This is currently covered by local interfaces but complicates shared API/cloud typing.

### Cloud read failures

Cloud writes now throw so their pending state remains retryable and the UI can report failure. Pull helpers return `null` on read or authorization failure; callers must not treat that as an empty cloud account.

## Security and operational boundaries

### Browser-local Gemini key

The personal Gemini key is stored in `calsync_ai_api_key` and sent directly from the browser to Google. Local Storage is not a secret vault: browser-profile access or a malicious extension can read it. A security-oriented rebuild should consider a server-side, rate-limited proxy, although that would be an intentional architecture change.

### Account-delete error handling — improved

The route verifies identity and MFA before using the service-role key, and reports failure when Auth deletion fails. It depends on `ON DELETE CASCADE` foreign keys for associated rows. Their presence in a target database must be verified with the migration preflight; this checkout does not establish them.

### External support API

The support form sends user data to `api.itsmarian.dev`, not to a local Next route. A rebuild must either provide that API deliberately or replace the support flow. Its server contract is not documented in this repository.

### CI is disabled

`.github/workflows/playwright.yml` exists, but the job is disabled with `if: false`. Do not silently assume that this pipeline currently runs.

## Local deletion scope

The active owner's explicit Delete All Data flow clears local food, drinks, workout history, drafts, favorites, goals, personal settings and sync queues after the cloud reset RPC succeeds. Cookie consent and app-update/install state are intentionally retained because they are not health data or account settings.

## Update/changelog note

`public/changelog.json` is the source of changelog entries. Acknowledgements are stored under guest- or user-specific Local Storage keys and synchronized to `profiles.latest_version` for signed-in users. This requires a profile column and grants that are not established by the sole migration in this checkout. There is no Supabase changelog table in the repository contract.

## Migration sources missing from this checkout

The application expects base profile/health tables, unique sync keys, reset
markers, an MFA-aware RLS setup and `clear_healthsync_data()`. Only the
newsletter-preference migration is present under `supabase/migrations/`. The
reference SQL in `hosting.md` does not create the policies or RPC. Until the
missing schema/security sources or separately reviewed deployment records are
available, treat the live database shape, grants, policies and reset behavior
as unverified.

The existing `hosting.md` section 4.2 is titled as if it includes RLS policies,
but its SQL only enables RLS and defines no policies. Its section 4.4 also
refers to security and profile-version migrations that are absent from this
checkout. Its table-of-contents anchors and numbering also do not match several
section headings. Those portions remain unchanged because this audit was
restricted to `docs/` and the root `README.md`; treat the referenced migration/
policy claims as unverified until the source files or direct target-database
evidence are available.

## Consequence for agents

When changing one of these areas:

1. document current code behavior,
2. separate the desired target behavior from the current behavior,
3. plan migration/compatibility for existing Local Storage data,
4. test sync and offline cases,
5. remove or update this file when the divergence is fixed.

