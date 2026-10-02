# Known Gaps and Technical Notes

This file deliberately records places where the current implementation, older documents and the ideal target architecture do not fully match. It prevents agents from treating an outdated description as a current contract.

## Outdated or divergent documentation

### `FUNCTIONALITY.md`

It contains valuable domain information but partly describes the former Vanilla-JS/monolithic structure. Statements such as “the three sections are only React state in `page.tsx`” no longer match the current route structure: `/dash`, `/food` and `/drinks` are separate Next pages. `src/app/page.tsx` only redirects to `/dash`.

### Weather proxy

Older documents mention a weather proxy. The current [WeatherWidget.tsx](../../src/app/_components/dashboard/WeatherWidget.tsx) calls Open-Meteo directly; [location.ts](../../src/app/_lib/location.ts) calls Nominatim directly. There is no matching Next API proxy in this repository.

### Test scripts

`package.json` now provides `test` and `test:watch` for the Node test suite and `test:e2e` for Playwright. Database policy integration still requires a local or isolated Supabase project.

## Data and sync risks

### Water goal on first cloud settings insert — fixed

The UI, initial cloud insert, and reset RPC now share a 2500 ml default. A numeric zero is preserved as an explicit goal value.

### Macro goals with value 0 — fixed

Cloud values of zero are written locally and treated as an explicit disabled goal.

### Drink upsert — fixed

Food and drinks both use upserts with `(user_id, entry_id)`; offline writes remain pending until acknowledged.

### Workout history across devices — fixed

Completed sessions upload idempotently and are pulled from `workout_sessions` during normal authenticated sync. The migration adds the unique key needed for safe upserts.

### Types versus UI session objects

`_lib/types.ts` describes `WorkoutSet` with `done` and `WorkoutSessionExercise` with `exerciseName`. `WorkoutModal.tsx` additionally uses UI fields such as `state`, `activeStartTime`, `completedAt`, `isPR` and a local `name` structure. This is currently covered by local interfaces but complicates shared API/cloud typing.

### Cloud read failures

Cloud writes now throw so their pending state remains retryable and the UI can report failure. Pull helpers return `null` on read or authorization failure; callers must not treat that as an empty cloud account.

## Security and operational boundaries

### Browser-local Gemini key

The personal Gemini key is stored in `calsync_ai_api_key` and sent directly from the browser to Google. Local Storage is not a secret vault: browser-profile access or a malicious extension can read it. A security-oriented rebuild should consider a server-side, rate-limited proxy, although that would be an intentional architecture change.

### Account-delete error handling — improved

The route verifies MFA before using the service-role key, and reports failure when Auth deletion fails. It relies on verified `ON DELETE CASCADE` foreign keys for health data; inspect these constraints using the migration preflight before rollout.

### External support API

The support form sends user data to `api.itsmarian.dev`, not to a local Next route. A rebuild must either provide that API deliberately or replace the support flow. Its server contract is not documented in this repository.

### CI is disabled

`.github/workflows/playwright.yml` exists, but the job is disabled with `if: false`. Do not silently assume that this pipeline currently runs.

## Local deletion scope

The active owner's explicit Delete All Data flow clears local food, drinks, workout history, drafts, favorites, goals, personal settings and sync queues after the cloud reset RPC succeeds. Cookie consent and app-update/install state are intentionally retained because they are not health data or account settings.

## Update/changelog note

`public/changelog.json` is the local source of entries. Parts of `_lib/changelog.ts` contain compatibility functions whose cloud persistence is currently a no-op; `UpdateCenter.tsx` uses local keys for visible state. A rebuild should not assume a Supabase changelog table.

## Consequence for agents

When changing one of these areas:

1. document current code behavior,
2. separate the desired target behavior from the current behavior,
3. plan migration/compatibility for existing Local Storage data,
4. test sync and offline cases,
5. remove or update this file when the divergence is fixed.

