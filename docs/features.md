# Feature Behavior

## Dashboard

Source: `src/app/_components/dashboard/*` and `src/app/_hooks/useDashboardData.ts`.

### Calculation

The Dashboard hook reads food from `calsync_v1`, drinks from `dropsync_v3` and goals from the local goal keys. It sums today's calories, water, protein, carbohydrates and fat. Percentages are clamped to 0–1.

The score is a percentage from 0 to 100:

```text
If at least one macro goal is > 0:
  score = 100 * (0.40 * caloriePercent
               + 0.35 * waterPercent
               + 0.25 * average(enabledMacroPercents))

If no macro goal is active:
  score = 100 * (0.50 * caloriePercent + 0.50 * waterPercent)
```

`entryCount` counts today's food and drink entries. The streak walks backward from today and counts every day with at least one food or drink entry. The weekly view contains the last seven local days.

### Widgets

- `MetricGrid`: calorie and water progress plus remaining/over-goal text.
- `MacroGrid` and `MacroRings`: protein, carbs and fat; a goal of 0 disables that progress.
- `ScoreRing`: SVG score ring.
- `WeekChart`: two bars per day for calories and water.
- `RecentList`: combined entries sorted descending by `ts`.
- `NextWidget`: rule-based next step, mainly hydration, protein or calorie guidance.
- `AiTips`: despite its name, fully rule-based and does not call Gemini; text is based on stats and time of day.
- `ActivityStatus`: `active`, `sick`, `injured` or `on_a_break`, each with a duration.
- `WeatherWidget`: optional direct Open-Meteo/Nominatim calls after consent and location permission.

## CalSync – food tracking

Source: `src/app/_components/calsync/CalSync.tsx`, `CalSyncModal.tsx`, `FoodList.tsx` and `MacroRings.tsx`.

### Input methods

1. **Manual**: enter name, amount/unit and nutrition values. The preview scales nutrition to the chosen amount.
2. **Search**: the search popup calls Open Food Facts with debounce and abort support. A result is confirmed with an amount.
3. **Barcode**: ZXing accesses the camera, detects the barcode and then loads the product from Open Food Facts.
4. **AI Detection**: text description, image import or camera capture; the result opens as an editable nutrition draft.

### Saving food

After confirmation, a `FoodEntry` is built with client ID, `ts`, `date`, scaled macros and optional barcode/source metadata. It is written to `calsync_v1`, a local `storage` event is dispatched and, if signed in, it is asynchronously synchronized to Supabase.

A barcode product classified as a liquid sets `isDrink` but initially remains a FoodEntry. DropSync is a separate workflow; do not merge the domains without an explicit migration.

### AI Detection

All of these conditions are required:

- `calsync_ai_enabled === 'true'`
- `calsync_ai_terms_accepted === 'true'`
- `calsync_ai_api_key` exists and has been validated
- third-party consent is granted

`gemini.ts` reduces images to a maximum 1280-pixel edge and JPEG quality 0.82 when browser APIs are available. Gemini is asked to return JSON containing name, brand, amount, unit, calories, protein, carbs and fat. The response is normalized and invalid/negative numbers are converted to safe fallbacks.

AI errors are classified internally as `quota`, `no_json` or `api_error` and converted to UI messages by `describeGeminiError`. The API key remains local and must not enter analytics, logs or exports.

### Pending drafts

AI results can be dismissed into a later editable draft. There is a list (`calsync_pending`) for multiple drafts and an active draft (`calsync_active_draft`) for resuming the modal. Drafts older than seven days are cleaned up. A draft is not a FoodEntry and must not affect calorie or streak calculations.

### History and deletion

`CalHistoryModal` shows older food data. Individual entries or all entries for today can be deleted. The UI removes them locally immediately, attempts cloud deletion and offers undo for central deletion flows.

## DropSync – hydration tracking

Source: `src/app/_components/dropsync/*`.

### Display

DropSync reads `dropsync_v3`, filters today's entries using the `date` string and calculates:

```text
progress = min(totalToday / waterGoal, 1)
strokeDashoffset = 2π * 95 * (1 - progress)
```

At 1000 ml and above, the value is displayed in liters. It also shows percentage, number of drinks and time since the last entry.

### Add flow

The bottom-sheet flow has two steps:

1. `DrinkPicker`: choose a drink type.
2. `GlassInput`: choose the amount by dragging or using quick buttons.

Snap points are `100, 150, 200, 250, 330, 400, 500, 750, 1000 ml`; the snap threshold is 28 ml. Pointer movement is converted to milliliters, and snap events trigger short haptic feedback when `navigator.vibrate` is available.

Saving appends a `DrinkEntry` locally, updates UI state and calls `syncDrinkToCloud` when a session exists.

### History and deletion

`HistoryModal` groups entries by date and uses “Today”, “Yesterday” or a formatted date. Individual entries and the current day's entries can be deleted. The confirmation can be disabled with `dropsync_delete_warning`.

## Workouts

Source: `WorkoutModal.tsx`, `WorkoutHistoryModal.tsx` and `public/exercises.json`.

### Routines

- Routines contain an ID, name, icon and exercises.
- Exercises contain name, sets/reps, optional weight/notes and asset/instruction data.
- The catalog is loaded once from `/exercises.json` and cached in the module.
- Routine creation, editing, deletion and reordering require preferences consent.
- Routines are stored locally with `_updated_at` and synchronized through `user_settings.workout_routines` after sign-in.

### Active session

On start, routine exercises are enriched from the catalog. A session has start time, routine ID/name, sets and a live timer. It can be minimized, resumed with a rest timer and filled with weight/reps sets.

On finish, end time, duration and intensity are calculated, the local log is prepended to `healthsync_workout_logs` and `pushWorkoutSessionToCloud` is called when signed in. Success and possible personal records are shown as toasts.

Workout history currently reads from the local log. There is no normal-auth-sync pull from `workout_sessions`.

## Settings

Source: `SettingsModal.tsx` and the related settings modals.

### Goals and calculators

- calorie goal: manual value or Mifflin-St Jeor calculator
- water goal: manual value or calculator based on weight, activity, sex and climate
- macro goals: protein, carbs and fat; 0 disables a goal
- changes are written to local keys immediately and to `user_settings` when signed in

### Preferences

Themes, header name, splash screen, sheet expansion, delete confirmation, weather and supplements use local settings. Preferences are only saved/applied when consent allows it.

### Supplements

Creatine and magnesium goals can be calculated from body weight. Daily intake is stored locally by date. The section is exposed in the extra menu only when tracking is enabled.

### Export and account

Settings provides local export and local deletion. Full account deletion requires confirmation, a valid Supabase token and a signed-in user, then uses `/api/account/delete`.

## Authentication and account management

The login page has internal views for login, registration, MFA, 2FA setup, reset, reset MFA, confirmation and logged-in state. Password login can lead directly to the MFA challenge. Registration passes name/avatar metadata to Supabase. The global `AuthContext` synchronizes local data after successful sign-in.

Session tokens are held in cookies through the Supabase SSR browser client. HealthSync does not maintain its own password database and does not store session tokens as domain data in Local Storage.

## Onboarding and tour

When `calsync_onboarding_done` is missing, `AppShell` redirects unsigned users to `/onboarding`. The onboarding page sets the marker, dispatches `onboarding:done` and replaces the route with `/dash`.

Afterwards, the tooltip tour can start or be requested again from the tour code. It waits for elements with known IDs and stops after bounded retries if a target never appears.

## Update Center and PWA

The Service Worker is in `src/app/sw.ts` and is registered by Serwist under `/serwist/sw.js`. It precaches build assets, uses `defaultCache` and serves `public/offline.html` for navigation failures.

When a new worker is waiting, `UpdateCenter` marks `healthsync_update_available`, shows a banner/changelog and can send `SKIP_WAITING`. On `controllerchange`, a pending reload causes the page to reload.

`public/manifest.json` defines standalone portrait mode, `/dash` as start URL and Food/Drinks shortcuts. The install banner uses `beforeinstallprompt` and is suppressed by `hs_install_dismissed`.

## Consent and external services

Consent is stored in `cookieSettings`:

- `analytics`: Google Analytics may be enabled
- `preferences`: local preferences and workout/weather features may be used
- `thirdparty`: external data/AI services may be contacted

The app starts with consent denied. The cookie banner also updates Google Consent Mode. Each feature must check its capability before making an external request.

## Legal and support

Legal pages are standalone pages built from reusable `Legal*` components. Support sends reason, description, optional email, user information, app version, timestamp and user agent to the external support API. The UI displays a 500-character limit; backend validation is outside this repository.

