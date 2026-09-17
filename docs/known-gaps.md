# Known Gaps and Technical Notes

This file deliberately records places where the current implementation, older documents and the ideal target architecture do not fully match. It prevents agents from treating an outdated description as a current contract.

## Outdated or divergent documentation

### `FUNCTIONALITY.md`

It contains valuable domain information but partly describes the former Vanilla-JS/monolithic structure. Statements such as “the three sections are only React state in `page.tsx`” no longer match the current route structure: `/dash`, `/food` and `/drinks` are separate Next pages. `src/app/page.tsx` only redirects to `/dash`.

### Weather proxy

Older documents mention a weather proxy. The current [WeatherWidget.tsx](../../src/app/_components/dashboard/WeatherWidget.tsx) calls Open-Meteo directly; [location.ts](../../src/app/_lib/location.ts) calls Nominatim directly. There is no matching Next API proxy in this repository.

### Test scripts

Older README/AGENTS text mentions `npm test`, `npm run test:watch` and `npm run test:e2e`. These scripts are currently missing from `package.json`; use `npx playwright test` directly.

## Data and sync risks

### Water goal on first cloud settings insert

The UI defaults to 2500 ml. `ensureSettings()` in `sync.ts` currently falls back to 2000 when creating the first cloud row without a local value. A new cloud settings row can therefore receive a different water goal from the local UI default. Before fixing it, decide whether 2500 should be the canonical default everywhere.

### Macro goals with value 0

`AuthContext.applySettingsToLocalStorage()` writes protein, carb and fat goals only when the cloud value is greater than 0. A cloud value of 0 therefore cannot actively remove an older positive local value. A fix must distinguish “no goal” from “not loaded yet”.

### Drink upsert

Food uses an upsert with `user_id,entry_id`. `syncDrinkToCloud()` currently uses a normal insert. Repeating the same drink write can therefore hit a unique constraint; the local UI remains valid.

### Workout history across devices

Routines are loaded/merged through `syncWorkouts()`. Completed sessions are written, but `healthsync_workout_logs` is not pulled from `workout_sessions` during normal auth sync. Workout history is therefore primarily browser-local.

### Types versus UI session objects

`_lib/types.ts` describes `WorkoutSet` with `done` and `WorkoutSessionExercise` with `exerciseName`. `WorkoutModal.tsx` additionally uses UI fields such as `state`, `activeStartTime`, `completedAt`, `isPR` and a local `name` structure. This is currently covered by local interfaces but complicates shared API/cloud typing.

### Cloud failures are mostly non-blocking

Many sync functions log errors and return `void` or `null` instead of blocking the UI. This is desirable for offline use, but a visible “Sync complete” state must not be interpreted as a guarantee that every cloud write succeeded.

## Security and operational boundaries

### Browser-local Gemini key

The personal Gemini key is stored in `calsync_ai_api_key` and sent directly from the browser to Google. Local Storage is not a secret vault: browser-profile access or a malicious extension can read it. A security-oriented rebuild should consider a server-side, rate-limited proxy, although that would be an intentional architecture change.

### Account-delete error handling

The delete route logs individual table failures and still attempts to delete the Auth user. A strictly transactional deletion would require a different procedure with explicit failure and retry handling.

### External support API

The support form sends user data to `api.itsmarian.dev`, not to a local Next route. A rebuild must either provide that API deliberately or replace the support flow. Its server contract is not documented in this repository.

### CI is disabled

`.github/workflows/playwright.yml` exists, but the job is disabled with `if: false`. Do not silently assume that this pipeline currently runs.

## Local deletion is not fully uniform

There are several delete paths:

- daily deletion removes only today's food or drinks
- Settings “All data deleted” mainly removes food/drinks and selected local values
- `logout(true)` removes a fixed list of domain/profile keys
- consent, update, favorite, install and some temporary keys may remain outside those lists

If a rebuild promises “delete all local data”, it needs an explicit versioned key list and tests.

## Update/changelog note

`public/changelog.json` is the local source of entries. Parts of `_lib/changelog.ts` contain compatibility functions whose cloud persistence is currently a no-op; `UpdateCenter.tsx` uses local keys for visible state. A rebuild should not assume a Supabase changelog table.

## Consequence for agents

When changing one of these areas:

1. document current code behavior,
2. separate the desired target behavior from the current behavior,
3. plan migration/compatibility for existing Local Storage data,
4. test sync and offline cases,
5. remove or update this file when the divergence is fixed.

