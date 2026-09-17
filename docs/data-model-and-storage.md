# Data Model and Storage

## Core principle

HealthSync stores domain data in the browser and optionally synchronizes it to Supabase. The local representation is the one used by the visible UI. Cloud sync is an additional transport and backup channel, not a requirement for basic offline use.

## TypeScript domain models

The central types are in [types.ts](../../src/app/_lib/types.ts).

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
| `healthsync_workout_logs` | locally completed workout sessions | `[]` | parallel write to `workout_sessions`; no full history pull currently |

### Goals and personal settings

| Key | Content | Default / notes |
|---|---|---|
| `calsync_goal` | calorie goal | `2000` |
| `dropsync_goal` | water goal in ml | `2500` in UI; `ensureSettings` currently uses `2000` for a new cloud row when no local value exists |
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

`calcSupplements` in [supplements.ts](../../src/app/_lib/supplements.ts) calculates at least 3 g creatine, otherwise roughly `0.1 g/kg`, and roughly `5 mg/kg` magnesium.

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
| `healthsync_last_seen_changelog_version` | last seen version | local changelog state |
| `healthsync_pending_reload_after_update` | reload after worker switch | boolean string |
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

`generateId()` in [ids.ts](../../src/app/_lib/ids.ts) combines a prefix, base-36 timestamp, process counter and random suffix. Food/drink entries use `entry_`, AI detections use `det_` and drafts use `draft_`. The client ID maps to Supabase `entry_id`; do not confuse it with the server UUID column `id`.

## Supabase schema and mapping

The executable schema is in [hosting.md](../../hosting.md). The four tables are:

### `calsync_entries`

Contains the server UUID, `user_id`, client `entry_id`, food/brand, nutritional values, unit/barcode metadata, `is_drink`, `ts` and `date`. `pushFoodEntriesToCloud` writes table fields only; the pull adds UI defaults for missing `emoji` and `color`.

### `dropsync_entries`

Contains `user_id`, `entry_id`, `drink`, `emoji`, `color`, `amount`, `ts`, `date`, `source` and `created_at`. Pulling maps `entry_id` back to `DrinkEntry.id`.

### `user_settings`

One row per user. It contains goals, optional `workout_routines` JSONB and `updated_at`. `pushSettings` uses `upsert(..., { onConflict: 'user_id' })`.

### `workout_sessions`

Contains `session_id`, routine information, ISO timestamps, duration and exercise JSONB. Routine definitions are stored in `user_settings.workout_routines` instead.

All tables require RLS policies enforcing `auth.uid() = user_id`. The schema in `hosting.md` contains the matching policies and unique constraints.

## Sync algorithms

### Authorization before sync

Before cloud operations, `sync.ts` calls `supabase.auth.getSession()` and sends the token/user ID to `/api/sync/verify`. Missing or expired tokens abort the operation and are logged.

### Food

1. Cloud food is loaded in ascending timestamp order.
2. Local food entries whose IDs are not in the cloud are added.
3. The merged result is sorted by timestamp and stored locally.
4. Local-only entries are uploaded afterward.
5. New local entries are stored optimistically and synchronized with an upsert.

### Drinks

Cloud and local drink IDs are merged analogously to food. New drinks are stored locally and written with `syncDrinkToCloud`; deletions are performed locally and through cloud delete.

### Settings

Cloud settings are mirrored into Local Storage. On first sign-in, a settings row is created from local goals. Local settings changes are written with `pushSettings`.

### Workouts

Routines use `_updated_at`. If only local or only cloud data exists, it is copied to the other side. If both exist, the newer timestamp wins. Completed sessions are stored locally in `healthsync_workout_logs` and also written to `workout_sessions`.

## Delete and export behavior

- Food/drink daily deletion removes only entries for the current `date` string; undo restores locally and attempts the cloud write.
- Settings offers a local export of food, drinks, workouts and goals. The exact scope is implemented in `SettingsModal.tsx`.
- “All data deleted” removes food, drinks and selected local data. Full account deletion goes through `/api/account/delete` and also deletes cloud rows and the Auth user.
- `logout(true)` removes a defined list of local domain/profile keys. Not every UI, consent, update or favorite key is in that list; this is intentional or currently inconsistent and is recorded in [known-gaps.md](./known-gaps.md).

