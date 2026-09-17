# Guide for Coding Agents and Rebuilds

This is the operational quick reference for an agent that needs to understand, modify or rebuild HealthSync.

## First orientation

Read in this order:

1. `AGENTS.md` at repository root
2. `docs/README.md`
3. `docs/architecture.md`
4. `docs/routing-and-contracts.md`
5. `docs/data-model-and-storage.md`
6. the relevant feature directory under `src/app/_components/`
7. the related route under `src/app/<route>/page.tsx`

Then run:

```bash
git status --short
rg -n "<symbol-or-keyword>" src public e2e
npm run lint
npm run build
```

Existing working-tree changes belong to the user. Do not reset, overwrite or restore deleted files unless explicitly requested.

## Architecture in one sentence

Route page + global `AppShell` + feature component + local JSON data + optional cloud write.

## Where does a change belong?

| Change | Primary location |
|---|---|
| new public route | `src/app/<route>/page.tsx`, possibly `sitemap.ts` and AppShell route logic |
| Dashboard number | `useDashboardData.ts` and affected Dashboard widget |
| food data flow | `calsync/CalSync.tsx`, `CalSyncModal.tsx`, `types.ts`, possibly `sync.ts` |
| drink data flow | `dropsync/DropSync.tsx`, modal components, `types.ts`, `sync.ts` |
| new global modal | `AppShellContext.tsx`, `AppShell.tsx`, modal component and header-button contracts |
| cloud synchronization | `sync.ts`, `AuthContext.tsx`, `hosting.md`/Supabase schema |
| new local setting | consuming component, `data-model-and-storage.md`, and possibly the logout clear list |
| external API | relevant `_lib`/feature, CSP in `proxy.ts`, consent check, routing-contract docs |
| PWA/update behavior | `sw.ts`, `UpdateCenter.tsx`, `manifest.json` |
| E2E behavior | existing `e2e/*.spec.ts`; currently run Playwright directly |

## Non-negotiable data invariants

1. Food and drink entries use client IDs and `date = new Date().toDateString()`.
2. `ts` is milliseconds since epoch and is used for sorting.
3. Supabase `entry_id` equals local `entry.id`; never join on server-side `id`.
4. Local writing happens before or at least in parallel with cloud writing.
5. Cloud sync must not make the app unusable on failure.
6. `SUPABASE_SERVICE_ROLE_KEY` may only be used server-side in `/api/account/delete`.
7. AI drafts are not automatically confirmed FoodEntries.
8. Modal-opening query parameters must be removed after processing.
9. External requests need matching capability and consent checks.
10. New storage keys must be added to the data documentation and, where appropriate, the `logout(true)` clear list.

## Common change workflows

### Add a food field

1. Extend `FoodEntry` and, if needed, `FoodSearchResult`.
2. Check all CalSync input paths: manual, search, barcode and AI.
3. Verify the Local Storage round trip.
4. Update the Supabase payload in `pushFoodEntriesToCloud` and the mapping in `pullFoodFromCloud`.
5. Check schema/RLS documentation and export behavior.
6. Check Dashboard/history aggregation.
7. Test local entry, sign-in sync and reload.

### Add a query-driven modal flow

1. Read the parameter in the route page.
2. Convert it into local state.
3. Remove it with `router.replace` after taking it over.
4. The close callback must reset both state and URL.
5. Build AppShell extra actions or external links on this stable contract.
6. Add E2E coverage for direct navigation and refresh.

### Add an external integration

1. Define and constrain request/response schemas.
2. Check consent and browser capability.
3. Check CSP `connect-src`, and possibly `img-src`/`script-src`.
4. Add abort/timeout behavior and understandable error states.
5. Never log keys or personal health data.
6. Add the integration to the routing-contract and feature documentation.

### Add a Supabase table

1. Design it with an owner column `user_id` and an RLS policy.
2. Define unique/conflict keys matching the client.
3. Encapsulate CRUD in `sync.ts`.
4. Preserve token/user verification before every operation.
5. Update `hosting.md`.
6. Analyze initial sync, offline sync and logout deletion.

## Expected function contracts

### `useDashboardData()`

Always returns a complete `DashboardData` object. SSR/initial values are empty-like; a local calculation follows. Consumers should not depend on `undefined` fields.

### `sync.ts`

- Push functions return `Promise<void>` and log errors; the normal UI flow generally does not rethrow them.
- Pull functions return `T[] | null`; `null` means sync/authorization failure, while `[]` means a successful empty result.
- `mergeFoodEntries` and `mergeDrinkEntries` deduplicate by local IDs and sort by `ts`.
- `syncWorkouts` returns `WorkoutRoutines | null` and resolves conflicts by timestamp.

### Route handlers

Own API routes return JSON with `ok` and optional `error`. Status codes are listed in [routing-and-contracts.md](./routing-and-contracts.md). A client must handle both HTTP status and body.

### Toasts

`showToast(message, duration?, undo?, className?)` adds a message to a shared toast queue. Multiple messages are folded into the visible toast. Undo callbacks should be idempotent or protected against repeated execution.

## UI and accessibility rules

- Existing `id` attributes are integration points for the tour, header-button control and E2E; search before changing them.
- Modals need overlay, handle, Escape/close behavior and focus management.
- Present camera and geolocation failures as understandable text.
- Use `button type="button"` for state-changing buttons that are not submits.
- Never use `innerHTML` for user input; JSX escapes automatically.

## Verification after changes

### Always

- `git diff --check`
- `npm run lint`
- affected E2E specs, or at least Playwright against the relevant route

### For build/routing/metadata changes

- `npm run build`
- direct navigation to the new route
- refresh with and without query parameters
- unknown route and legal/support pages

### For data/sync changes

- create offline, reload and find the entry locally
- synchronize while signed in
- simulate cloud failure and keep using the local UI
- logout with and without data deletion
- check duplicate cloud/local IDs

### For AI/camera/weather changes

- missing consent
- missing key or missing browser API
- external error/timeout
- sensitive values absent from logs and exports

## Rebuild order for a minimal compatible implementation

1. Next App Router skeleton and global layout/CSP/PWA files.
2. Supabase browser client and AuthContext.
3. Local Storage layer and types.
4. Root/AppShell with route navigation and toasts.
5. Dashboard from local food/drink data.
6. CalSync and DropSync with local writes.
7. Cloud sync and account deletion.
8. Settings, workouts and onboarding.
9. AI, barcode, weather and Update Center.
10. Legal/support pages and E2E coverage.

For a compatible rebuild, reproduce the storage, routing and sync contracts first, then refine the exact visual presentation.

