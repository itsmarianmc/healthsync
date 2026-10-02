# Data Model and Storage

## Core principle

HealthSync stores domain data in the browser and optionally synchronizes it to Supabase. The local representation is the one used by the visible UI. Cloud sync is an additional transport and backup channel, not a requirement for basic offline use.

## TypeScript domain models

The central types are in [types.ts](../src/app/_lib/types.ts).

### FoodEntry

```ts
interface FoodEntry {
  id: string;
  food: string;
  brand?: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  weight?: number;
  amount?: number;
  unit?: string;
  emoji?: string;
  color?: string;
  ts: number;          // Date.now(), milliseconds
  date: string;        // new Date().toDateString()
  source?: string;
  isDrink?: boolean;
  isBarcode?: boolean;
  barcode?: string;
  status?: 'pending' | 'confirmed';
}
```

`kcal`, `prot`, `carb` and `fat` describe the logged quantity. Search, barcode and AI results instead use per-100 values and are scaled to the chosen amount when confirmed.

### DrinkEntry

```ts
interface DrinkEntry {
  id: string;
  drink: string;
  emoji?: string;
  color?: string;
  amount: number;      // ml
  ts: number;          // milliseconds
  date: string;        // new Date().toDateString()
  source?: string;
}
```

### FoodSearchResult and AI drafts

`FoodSearchResult` contains `kcalPer100`, `protPer100`, `carbPer100`, `fatPer100`, optional Open Food Facts metadata and flags such as `isLiquid`, `isBarcode`, `isManual` or `isFavourite`.

AI results are first normalized as `GeminiAnalysis` and then converted into an editable `FoodSearchResult` draft. They are not automatically saved as final entries without confirmation.

`PendingFoodDraft` stores `id`, a food result, amount, unit (`g`, `ml` or `pcs`) and creation timestamp.

## Local Storage keys

All values are strings. Arrays and objects are JSON-serialized. Scope is limited to the browser profile and origin.

### Domain data

| Key | Content | Default / lifecycle | Cloud relation |
|---|---|---|---|
| `calsync_v1` | `FoodEntry[]` | `[]` | `calsync_entries` |
| `dropsync_v3` | `DrinkEntry[]` | `[]` | `dropsync_entries` |

| `calsync_pending` | multiple pending food drafts | expired drafts removed after 7 days | no |
| `calsync_active_draft` | currently edited AI draft | one temporary draft, 7-day TTL | no |
| `calsync_favourites` | up to 50 favorite food-result objects | `[]` | no |
| `healthsync_workouts` | `{ routines, _updated_at }` | empty/missing | `user_settings.workout_routines` |
| `healthsync_workout_logs` | active owner's completed workout sessions | `[]` | pending sessions upload idempotently; cloud history is pulled in full |

When a searched or scanned food is classified as a liquid, `foodLog.ts` writes its FoodEntry to `calsync_v1` and a matching DrinkEntry to `dropsync_v3` with the same client ID. Signed-in users queue both records for cloud sync.

### Goals and personal settings

| Key | Content | Default / notes |
|---|---|---|
| `calsync_goal` | calorie goal | `2000` |
| `dropsync_goal` | water goal in ml | `2500` in UI and for a new cloud row; `0` is preserved as an explicit value |
| `calsync_goal_ml` | legacy water goal | migrated by `AuthContext` to `dropsync_goal` and removed |
| `calsync_goal_protein` | protein goal in g | `0` means no goal |
| `calsync_goal_carbs` | carbohydrate goal in g | `0` means no goal |
| `calsync_goal_fat` | fat goal in g | `0` means no goal |
| `calsync_first_name` | preferred first name | empty |
| `calsync_display_name` | show first name in header | `false` |
| `calsync_theme` / `dropsync_theme` | theme name | `dark`/`default`; mirrored |
| `calsync_splash_enabled` | show splash | `false` |
| `healthsync_modals_expanded` | sheets initially expanded | `false` |
| `dropsync_delete_warning` | show delete confirmation | anything except exact `'false'` means `true` |
| `healthsync_rest_seconds` | workout rest duration | `90` seconds, bounded by UI |

### Supplements and activity status

| Key | Content |
|---|---|
| `calsync_track_supplements` | `'true'` enables supplement UI |
| `calsync_user_weight_kg` | weight for automatic supplement goals |
| `calsync_creatine_goal` | calculated/manual creatine goal in g |
| `calsync_magnesium_goal` | calculated/manual magnesium goal in mg |
| `calsync_supplements_taken` | `Record<string, Record<string, boolean>>` by date/supplement |
| `healthsync_activity_status` | `ActivityStatusRecord` JSON |

`calcSupplements` in [supplements.ts](../src/app/_lib/supplements.ts) calculates at least 3 g creatine, otherwise roughly `0.1 g/kg`, and roughly `5 mg/kg` magnesium.

### AI, consent, onboarding and updates

| Key | Content | Sensitivity / note |
|---|---|---|
| `calsync_ai_enabled` | AI Detection opt-in | only `'true'` enables it |
| `calsync_ai_terms_accepted` | AI terms accepted | required for AI |
| `calsync_ai_api_key` | personal Gemini key | treat as secret; never export or log |
| `cookieSettings` | `{ analytics, preferences, thirdparty }` | consent state |
| `bannerAccepted` | cookie banner has been handled | boolean string |
| `calsync_onboarding_done` | intro completed | `'1'` |
| `calsync_tour_done` | tour status | used by tour code |
| `calsync_pending_tour` | start tour after navigation | transient `'1'` marker |
| `healthsync_update_available` | Service Worker is waiting | boolean string |
| `healthsync_dismissed_banner` | update banner dismissed | boolean string |
| `healthsync_last_seen_changelog_version_guest` | last seen version for guests | never copied into an account |
| `healthsync_last_seen_changelog_version_user_<user-id>` | last seen version for one signed-in account | combined only with that account's owner-protected `profiles.latest_version` |
| `healthsync_last_seen_changelog_version` | old browser-wide acknowledgement | ignored because its owner cannot be determined; retained only as legacy browser data |
| `healthsync_pending_reload_after_update` | one-time marker consumed after a worker switch and app reload to open the Update Center | boolean string |
| `hs_install_dismissed` | PWA install banner dismissed | `'1'` |

### Weather

| Key | Content |
|---|---|
| `healthsync_weather_enabled` | widget enabled |
| `healthsync_weather_lat` | stored latitude |
| `healthsync_weather_lon` | stored longitude |
| `healthsync_weather_name` | location name |

The weather code migrates older keys `weather_widget_enabled`, `weather_latitude`, `weather_longitude` and `weather_location_name` when reading.

## Time and identity rules

### Date

`date` is **not an ISO date**. It is the result of `new Date().toDateString()`, for example `"Thu Sep 17 2026"`. Dashboard, history, streak and daily deletion compare this exact string. Changing to UTC or ISO dates would be a data migration, not a formatting-only change.

### Timestamp

`ts` is `Date.now()` in milliseconds. It is used for sorting, cloud pulls and “time ago” labels.

### IDs

`generateId()` in [ids.ts](../src/app/_lib/ids.ts) combines a prefix, base-36 timestamp, process counter and random suffix. Food/drink entries use `entry_`, AI detections use `det_` and drafts use `draft_`. The client ID maps to Supabase `entry_id`; do not confuse it with the server UUID column `id`.

## Supabase schema and mapping

The app code expects the four health-data tables and `profiles` described below. The SQL schema in [hosting.md](../hosting.md) is a setup/reference script. This checkout contains only one executable migration, which adds newsletter fields to an already existing `public.profiles` table; it does not create the base tables, policies, grants or reset RPC. Therefore these definitions describe the app's expected shape, not a verified live database schema.

### `calsync_entries`

Contains the server UUID, `user_id`, client `entry_id`, food/brand, nutritional values, unit/barcode metadata, `is_drink`, `ts` and `date`. `pushFoodEntriesToCloud` writes table fields only; the pull adds UI defaults for missing `emoji` and `color`.

### `dropsync_entries`

Contains `user_id`, `entry_id`, `drink`, `emoji`, `color`, `amount`, `ts`, `date`, `source` and `created_at`. Pulling maps `entry_id` back to `DrinkEntry.id`.

### `user_settings`

One row per user. It contains goals, optional `workout_routines` JSONB and `updated_at`. `pushSettings` uses `upsert(..., { onConflict: 'user_id' })`.

### `workout_sessions`

Contains `session_id`, routine information, ISO timestamps, duration and exercise JSONB. Routine definitions are stored in `user_settings.workout_routines` instead.

Health data tables require owner-scoped RLS policies. The app and historical
runbook expect `profiles` to be scoped by `id = auth.uid()` and protected by
the verified-factor/AAL policy, but the migrations that establish those rules
are not present in this checkout. Do not infer current database grants or
policies from the client code or reference SQL; inspect the target database
using the preflight in [`security-migration.md`](./security-migration.md).

Account identity and account preferences are read from `profiles`; health goals,
supplement preferences and workout routines use `user_settings`. The sole
checked-in migration, `20261002010000_profile_newsletter_preferences.sql`, adds
`newsletter_opt_in` (false by default), `newsletter_opt_in_at` and
`newsletter_opt_out_at`. An owner may read the preference and timestamps and
update only the preference. A database trigger records the latest opt-in or
opt-out transition time. This stores consent preference only; it does not
connect a mail provider or send newsletters. The migration grants authenticated
column access but does not create or alter the profile table's RLS policies.
The required owner and MFA RLS authorization boundary must already exist in
the target database and was not verified in this audit.

## Sync algorithms

### Authorization before sync

Before cloud operations, `sync.ts` calls `supabase.auth.getSession()` and sends the token/user ID to `/api/sync/verify`. Missing or expired tokens abort the operation and are logged.

### Food

1. Cloud food and deletion tombstones are loaded in ascending timestamp order.
2. Pending entries and legacy local entries absent from cloud are uploaded unless a cloud tombstone supersedes them.
3. The confirmed cloud result replaces the local list only after a successful read; failed writes retain pending records for retry.
4. New local entries are stored optimistically and synchronized with an idempotent upsert.

### Drinks

Cloud and local drinks follow the same pending/legacy recovery and tombstone rules. New drinks are stored locally and written with `syncDrinkToCloud`; deletions are queued locally before the cloud tombstone write.

### Settings

Cloud settings are mirrored into Local Storage. On first sign-in, a settings row is created from local goals with explicit activity-status and supplement defaults for older schemas with NOT NULL constraints. Local settings changes are written with `pushSettings`; their pending keys are acknowledged only while the same owner workspace is active.

### Workouts

Routines use `_updated_at`. If only local or only cloud data exists, it is copied to the other side. If both exist, the newer timestamp wins. Completed sessions are stored in the active owner's `healthsync_workout_logs` and uploaded by `(user_id, session_id)`. Pending sessions and older local sessions absent from cloud are uploaded before the confirmed cloud history is stored; local additions made during sync remain in the active workspace.

`syncWorkouts()` returns `null` only when neither local nor cloud routines exist (or when the active workspace changes before local access). Authorization, read and write failures throw and make the enclosing sync fail without discarding pending local work. In-flight sync confirmations check the active owner before changing local markers. Sync completion toasts are limited to visible main app routes and are cancelled on navigation, tab hide or account change. A toast with Undo is not replaced by later sync messages.

### Changelog acknowledgement and MFA

For an account, the update center merges only its user-ID local marker with its own `profiles.latest_version`. A profile read or write failure leaves the account's local marker available for retry and does not claim cloud persistence. The legacy global marker is not assigned to the next account that signs in.

The login screen no longer offers a remembered-device checkbox. The former `healthsync_remember_mfa_device` value is ignored; it never provided a server-verified device identity. A verified TOTP factor still requires an AAL2 session for protected profile, health-data, API and account actions.

## Delete and export behavior

- Food/drink daily deletion removes only entries for the current `date` string; undo restores locally and attempts the cloud write.
- Settings offers a local export of food, drinks, workouts and goals. The exact scope is implemented in `SettingsModal.tsx`.
- “Delete All Data” calls the target database's `clear_healthsync_data()` RPC and clears local health data only after the RPC succeeds. The app expects the RPC to enforce authorization, clear the account's cloud health rows and reset settings while preserving profile identity fields; its definition is absent from this checkout, so target behavior and MFA enforcement are unverified. Full account deletion goes through `/api/account/delete`; associated-row deletion depends on `ON DELETE CASCADE` foreign keys from `auth.users`, which also are not established by the migration present here.
- `logout(true)` removes a defined list of local domain/profile keys. Not every UI, consent, update or favorite key is in that list; this is intentional or currently inconsistent and is recorded in [known-gaps.md](./known-gaps.md).

