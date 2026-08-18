# HealthSync

**HealthSync** is a mobile-first Progressive Web App (PWA) for personal health tracking. The app combines calorie counting (CalSync), hydration tracking (DropSync), and workout logging under a unified interface and is available at `healthsync.itsmarian.dev`.

The project originated as an independent evolution from two separate projects — CalSync and DropSync — which were merged into a single platform. HealthSync is a personal project by Marian and is actively maintained.

---

## Goals

- Make daily calorie and macronutrient logging as seamless as possible
- Enable hydration tracking with minimal effort (pick a drink, set the amount by dragging, done)
- Log workout sessions with live timer and set logging
- Store all data both locally (offline-capable via localStorage) and in the cloud (Supabase)
- Deliver a native app-like experience in the browser: no page reloads, sheet modals, haptic feedback, PWA manifest

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS (custom CSS variables, no Tailwind for app styles) |
| Backend / Auth | Supabase (PostgreSQL, Row Level Security, MFA/TOTP) |
| Fonts | DM Sans (Google Fonts) |
| Icons | Font Awesome v7 |
| Barcode Scanner | ZXing (`@zxing/browser`) |
| QR Code (Login) | QRCode.js (CDN) |
| Deployment | Vercel, domain `healthsync.itsmarian.dev` |

---

## Design Language

HealthSync has a consistent dark-mode design with a warm orange accent. The app should feel like a native app on smartphones.

**CSS Variables (Root):**
```css
--bg: #0F0F10           /* background */
--surface: #1A1A1C      /* card background */
--surface2: #232326     /* inputs, secondary surfaces */
--surface3: #2E2E32     /* hover states */
--border: rgba(255,255,255,0.08)
--text: #F5F5F7
--text2: #8E8E93        /* secondary text */
--text3: #48484A        /* placeholder, disabled */
--accent: #E4840F       /* primary accent color (orange) */
--accent2: #FF9F0A
--error: #FF453A
--success: #30D158
--radius: 18px
--radius-sm: 12px
--ease: cubic-bezier(0.34, 1.15, 0.64, 1)
```

Font: **DM Sans** throughout. No Inter, no Roboto, no system font stack.

---

## Project Structure (Next.js)

```
healthsync/
├── public/
│   └── healthsync-static/     ← Original vanilla source files (reference for migration)
├── src/
│   └── app/
│       ├── layout.tsx          ← Root layout: AuthProvider, CSS import, metadata
│       ├── page.tsx            ← Main app shell: view switching, all modals
│       ├── styles.css          ← Global CSS (1:1 migrated from healthsync-static)
│       ├── login/
│       │   ├── layout.tsx      ← Login layout: QRCode CDN script
│       │   ├── page.tsx        ← Full login page as React client component
│       │   └── styles.css      ← Login-specific styles
│       ├── _lib/
│       │   ├── supabase.ts     ← createBrowserClient singleton (@supabase/ssr)
│       │   ├── types.ts        ← all TypeScript interfaces
│       │   └── sync.ts         ← all Supabase CRUD functions
│       ├── _context/
│       │   └── AuthContext.tsx ← auth state, user, settings, syncEnabled
│       ├── _hooks/
│       │   ├── useLocalStorage.ts
│       │   ├── useDashboardData.ts
│       │   └── useOnboarding.ts
│       └── _components/
│           ├── shared/         ← Toast, Tooltip, SplashScreen
│           ├── navigation/     ← BottomNav
│           ├── dashboard/      ← Dashboard + all sub-components including WeatherWidget and ActivityStatus
│           ├── calsync/        ← CalSync + modal + FoodList + BarcodeScanner
│           ├── dropsync/       ← DropSync + modal + DrinkPicker + GlassInput + history
│           ├── settings/       ← SettingsModal + goals + account + workout
│           ├── onboarding/     ← Onboarding slides + tooltip tour
│           └── update/         ← Update center for in-app updates and changelog
```

---

## App Structure: The Three Main Sections

The app is a single-page application. There are no Next.js routes for the three sections — view switching happens via React state in `page.tsx`. The bottom navigation switches between `'dashboard'`, `'calsync'`, and `'dropsync'`.

### Dashboard

The home page of the app. Shows a daily overview.

**Components and their functions:**

- **ScoreRing** — SVG ring chart with a total score of 0–100. The score is calculated with weights: calories (40%), water (35%), macros (25%). If no macro goals are set, only calories (50%) + water (50%) are weighted. `id="dashboardScoreRing"` on the `<circle>`, radius 48, `strokeDasharray = 2 * Math.PI * 48`.

- **MetricGrid** — Two progress bars for calories and water. Shows total amount, goal amount, and remaining amount ("X kcal left" / "X ml over"). IDs: `dashboardCalProgress`, `dashboardWaterProgress`, `dashboardCalories`, `dashboardWater`, `dashboardCalGoal`, `dashboardWaterGoal`, `dashboardCalLeft`, `dashboardWaterLeft`.

- **MacroGrid** — Three progress bars for protein, carbs, fat. Only active if macro goals are set in settings. Shows "X / Y g". IDs follow the pattern `dashboardProtein`, `dashboardProteinGoal`, `dashboardProteinProgress` etc.

- **WeekChart** — 7-day bar chart without external chart library. Flex container with one `div.dashboard-week-day` per day. Each day has two bars (`.dashboard-week-bar.calories`, `.dashboard-week-bar.water`) whose `height` is set inline as a percentage. The current day gets the class `.today`.

- **RecentList** — List of the last 5 entries of the day (food + drinks combined, sorted by timestamp). Empty state shows "Nothing logged yet."

- **NextWidget** — Rule-based tip widget. Shows a recommendation based on daily progress: focus on hydration if water < 55%, boost protein if protein < 55%, calories if < 65%, or "Goals complete" if both ≥ 100%.

- **AiTips** — Widget with `id="AiBox"`, `id="aiTipTitle"`, `id="aiTipText"`. Only displayed when `calsync_ai_enabled === 'true'`. Otherwise shows a skeleton loader. Refreshes every 5 minutes (`REFRESH_INTERVAL`) or when the stats hash changes (`totalCal|totalWater|totalProtein|entryCount|calGoal|waterGoal|proteinGoal`). Listens to `viewChanged` event: starts on dashboard tab, stops on other tabs. Listens to `requestAITipUpdate` custom event. Messages are fully rule-based (no API call) with time-dependent variants (morning/afternoon/evening/night). `window.refreshAITip` for external refresh.

- **WeatherWidget** — Weather widget that displays current weather for the user's location. Uses the Open-Meteo API via a proxy endpoint. Shows temperature, weather conditions, and location. Can be enabled/disabled in settings and uses cached location data.

- **ActivityStatus** — Activity status widget that shows the user's current training status (active, sick, injured, or on a break). Allows users to set their current status and specify a duration (until changed, until tomorrow, 7 days, 14 days, or custom date). The status is displayed on the dashboard and can be managed in settings.

**Data source:** Exclusively localStorage. No Supabase call in the dashboard. Reacts on `storage` events, `focus` events, `viewChanged` events, and every 30 seconds via `setInterval`.

**Streak calculation:** Counts backward from today how many consecutive days have entries. A day counts as "present" if at least one food or drink entry for that date exists in localStorage.

---

### CalSync (Food Tracking)

CalSync is the food logging section. The tab name in the original was "CalSync", the section ID is `calsync-view`.

**CalSyncModal** — The main modal for adding entries. Opens as a bottom-sheet. Has three input modes:

1. **Search** — Free-text search in a local food database
2. **Barcode Scanner** — ZXing-based camera scanner. Scans EAN barcodes and looks up the product in Open Food Facts or a custom database. Button ID: `cs-openModalBtn`
3. **Manual** — Form with fields for name, calories, protein, carbs, fat, weight. IDs: `manualKcal`, `manualProtein`, `manualCarbs`, `manualFat` (these are needed for the calorie preview calculation — `updateCaloriePreview()` is called on `input` events).

**Entry data structure:**
```typescript
interface FoodEntry {
  id: string           // UUID
  food: string         // food name
  kcal: number
  prot: number         // protein in g
  carb: number         // carbs in g
  fat: number          // fat in g
  weight?: number      // weight in g
  emoji?: string       // e.g. "🍎"
  color?: string       // CSS color for icon
  ts: number           // unix timestamp (ms)
  date: string         // new Date().toDateString()
  source?: string      // 'manual' | 'barcode' | 'search'
}
```

**Storage:** localStorage key `calsync_v1` (array). Cloud sync to Supabase table `food_entries`.

**MacroRings** — SVG ring charts for protein, carbs, fat. Shows daily progress relative to goals. If no goal is set, the ring is displayed in neutral color.

**FoodList** — List of all today's entries. Each entry has a swipe-to-delete or tap-to-delete button. When deleting, the entry is removed from localStorage and deleted via `deleteFoodFromCloud()` from Supabase.

---

### DropSync (Hydration Tracking)

DropSync is the most complex section of the app. The section ID is `dropsync-view`.

**Ring display** — SVG circle with `id="ringProgress"`. Radius 95. Circumference = `2 * Math.PI * 95`. `strokeDashoffset = circumference * (1 - totalToday / GOAL_DS)`. Beside it: `ringAmount` (text display of total amount, switches unit at ≥ 1000ml to "x,x L"), `statPct` (percentage display), `statCount` (number of entries), `statLast` (last entry "x min ago").

**DropSyncModal** — Bottom-sheet modal with two steps and its own drag system.

*Sheet states:*
- `'closed'` — modal invisible
- `'open'` — modal at natural height (auto), fades in from bottom
- `'expanded'` — modal fills almost the entire screen (`window.innerHeight - 24px`)

Transitions via CSS transition on `height` and `transform translateY`. During drag: `transition: none`. After release: transition re-enabled, snap to next position.

*Step 1 - DrinkPicker:*
Grid with drink options. Each option is a `div.drink-option` with `data-drink`, `data-emoji`, `data-color`. After selection, switches to Step 2.

*Step 2 - GlassInput:*
An SVG glass (`ds-glassContainer`) whose fill level is controlled by drag. Pointer up = more water, down = less. Delta in pixels is converted to ml: `deltaMl = (dy / 300) * 1000`. Snap-points at `[100, 150, 200, 250, 330, 400, 500, 750, 1000]` ml with a threshold of 28 ml. On snap: `navigator.vibrate(18)` for haptic feedback.

Quick-buttons (`.quick-btn`) with `data-ml` for common amounts.

*Entry data structure:*
```typescript
interface DrinkEntry {
  id: string           // UUID
  drink: string        // drink name e.g. "Water"
  emoji?: string       // e.g. "💧"
  color?: string       // CSS color
  amount: number       // ml
  ts: number           // unix timestamp (ms)
  date: string         // new Date().toDateString()
  source?: string      // 'dropsync'
}
```

**Storage:** localStorage key `dropsync_v3`. Cloud sync to Supabase table `dropsync_entries`.

**HistoryModal** — Second drag sheet. Shows all entries grouped by date (with `formatDateLabel`: "Today", "Yesterday", or full date). Same drag system as the main modal. Button ID: `ds-openHistoryBtn`.

**DrinkLog** — Daily log within the modal (`ds-logList`). New entries are inserted at the top without re-rendering the entire list (Set `renderedIds` prevents duplicate rendering). On delete: optimistic UI update, then cloud delete.

---

## Settings Modal

Accessible via button `db-openSettingsBtn` on the dashboard and `ds-openSettingsBtn` in DropSync. Opens as a bottom-sheet (same drag system as DropSync).

**GoalsSection:**
- Calorie goal (localStorage: `calsync_goal`, default: 2000)
- Water goal in ml (localStorage: `dropsync_goal`, default: 2500)
- Macro goals: protein, carbs, fat in g (localStorage: `calsync_goal_protein`, `calsync_goal_carbs`, `calsync_goal_fat`, default: 0 = no goal)
- On change: update localStorage + call `syncUserSettingsToCloud()` (push to Supabase)
- **GoalModal**: separate sheet modal (`id="goalModal"`) for calorie goal input, has two modes: "set" (direct input) and "calc" (calorie calculator). Own `createDraggableSheet` setup.
- **Calorie calculator**: Mifflin-St. Jeor formula. Inputs: weight, height, age, gender (option buttons), activity level (option buttons), goal (lose/maintain/gain). Result: TDEE in kcal + macro suggestions (30% protein, 40% carbs, 30% fat). Separate hydration calculation: `weight * 24.33` as base + adjustments for gender, activity, and climate. Results are stored in `window.lastKcalResult`, `window.lastProteinResult` etc. for "Apply" buttons.

**AccountSection:**
- If logged in: avatar (initials or profile picture), name, "Synced" badge, logout button, "Manage Account" link → `/login?keep_login_page=true`
- If logged out: login button → `/login?signinginto=healthsync`
- Avatar initials: first letter of `full_name` or `name` from `user_metadata`, fallback `email.split('@')[0]`
- `removeHeaderBtn(id)` / `addHeaderBtn(id)` — helper functions that hide/show settings buttons in view headers when opening/closing

**AI Detection Section:**
- Toggle `calsync_ai_enabled` (localStorage)
- Requires accepted terms of use (`calsync_ai_terms_accepted`) and a Gemini API key (`calsync_ai_api_key`)
- Checks cookie consent: `cookieSettings.thirdparty === true` must be set
- `isAIReady()` returns `true` if all four conditions are met
- After saving API key: `location.reload()` after 2222ms

**WorkoutSection:**
- 4-day plan: Pull (back/biceps), Push (chest/triceps), Legs (legs), Arms (arms/shoulders)
- Plans stored in localStorage under `healthsync_workouts` and synced to cloud via `workout_routines` (jsonb) in `user_settings`
- Active session: live timer (seconds), set logging (weight + reps per set), "Finish Session" saves to `workout_sessions`
- Exercise GIF modal: tap on exercise card header opens a video modal with the exercise GIF
- Sort exercises modal: drag-to-reorder for exercises within a routine

---

## Onboarding

On first visit (no `calsync_onboarding_done` in localStorage), an overlay with slides is shown. Slides are shifted horizontally via `translateX`. Dot indicators show progress.

After completion: **tooltip tour** (8 steps) is optional. Each step shows a tooltip on an element (based on `id`) with an explanation. Tooltip is positioned relative to the element. Next button advances to the next step, last step closes the tour.

`window.showOnboarding = startOnboarding` enables restarting from settings.

---

## Notes Modal

Accessible via button `openNotes` in the app. Opens as a bottom-sheet above the settings modal (settings gets the `.small` class in the process). Same drag-sheet system as settings and DropSync. `notes.js` is not an IIFE — variables are global, no `DOMContentLoaded` guard. When closing, `.small` is removed from settings after 100ms.

---
## Update Center

Shows available app updates and changelog entries. Users are notified about new versions and can install them directly in the app. Uses the Supabase changelog database to display version notes and new features. Includes a "What's new?" modal that displays updated version information and changes.

---

## Reusable Sheet System (`createDraggableSheet`)

Settings, Notes Modal, and GoalModal share the same generic drag-sheet system. It is initialized via `createDraggableSheet(config)` (defined in `script.js`):

```javascript
createDraggableSheet({
  handleZone: settingsHandleZone,
  modal: settingsModal,
  overlay: settingsOverlay,
  onClose: closeSettingsModal,
  getNaturalHeight: () => settingsNaturalHeight,
  setNaturalHeight: (h) => { settingsNaturalHeight = h }
})
```

In Next.js, this becomes a `useDraggableSheet(config)` hook that accesses the modal elements via ref.

---

## Pull-to-Refresh

Implemented in `menu.js` as an IIFE `initPullToRefresh()`. Touch-based: when `touchstart` occurs at the top of the document (`scrollY === 0`, no modal element in the path), a PTR indicator (`id="ptr-indicator"`) is shown. When sufficient pull occurs (`THRESHOLD = 50px`, `MAX_HEIGHT = 60px`) and it's released, `refreshAllData()` is called.

`refreshAllData()` calls: reload localStorage, `refreshDropsyncUI()`, `updateUI()`, `updateDateLabel()`, `updateCalorieWeekWidget()`, `updateSecondaryStats()`, `updateMacroRingsAndLeft()`, `renderLog()`. In Next.js: `useCallback`-based refresh that re-triggers all relevant states and context functions. The PTR indicator is implemented as a separate `PullToRefresh.tsx` component.

---

## Toast System

Queue-based toast system. Toasts appear at the bottom above the navigation. When multiple toasts appear in quick succession, they are shown sequentially (queue is processed). Each toast is visible for ~2 seconds, then fades out.

---

## Auth & Supabase

### Session Handling

The Supabase client is initialized with `createBrowserClient` from `@supabase/ssr`. Sessions are stored in **cookies** (not localStorage). This is important: the `createClient` from `@supabase/supabase-js` would use localStorage and is incompatible with the Next.js setup.

### AuthContext

Global React context that provides the following:
```typescript
interface AuthContextType {
  user: User | null
  syncEnabled: boolean       // true if user !== null
  loading: boolean
  settings: UserSettings | null
  refreshSettings: () => Promise<void>
  logout: () => Promise<void>
}
```

On mount: `supabase.auth.getSession()` → set user → load `user_settings` from Supabase → sync goals to localStorage.

`onAuthStateChange` listener runs continuously and reacts to login/logout.

### Sync Strategy

**Food & Drinks:** On pull, cloud and local are merged. Cloud IDs as a Set → local entries not in cloud are added → sorted by `ts` → stored in localStorage.

On push (new entry): save locally immediately (optimistic), then `upsert` to Supabase with `onConflict: 'entry_id'`.

**Settings:** `upsert` with `onConflict: 'user_id'`. On pull: sync values to localStorage and call UI refresh functions.

**Workouts:** Timestamp-based merge strategy. `_updated_at` is compared — newer version wins.

### MFA (TOTP)

The app supports two-factor authentication via TOTP (Time-based One-Time Password). Flow:
1. Login with email + password
2. Check `mfa.getAuthenticatorAssuranceLevel()`
3. If `nextLevel === 'aal2'` and not already verified → start MFA challenge
4. Verify TOTP code via `mfa.verify()`

The TOTP code is required on every login and verified server-side. No list of trusted devices is stored in the browser (the earlier `mfa_trusted_emails` concept was removed as it could undermine 2FA).

Setup/disable via the login page after successful login (viewSetup2FA).

---

## Supabase Database Schema

### `calsync_entries`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Auto-generated |
| user_id | uuid | Supabase auth user ID |
| entry_id | text UNIQUE | Client-generated UUID |
| food | text | Food name |
| brand | text | Brand (if provided by Open Food Facts) |
| kcal | numeric | Calories |
| amount | number | The weight (raw) |
| unit | text | Unit for "amount" |
| prot | numeric | Protein in g |
| carb | numeric | Carbs in g |
| fat | numeric | Fat in g |
| barcide | text | if barcode via OFF |
| ts | bigint | Unix timestamp in ms |
| date | text | `new Date().toDateString()` format |
| created_at | timestampz | Timestamp when the food was added |
| is_drink | boolean | if it's a drink (so it appears in DropSync) |

RLS: user can only read/write their own entries (`user_id = auth.uid()`).

### `dropsync_entries`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Auto-generated |
| user_id | uuid | Supabase auth user ID |
| entry_id | text UNIQUE | Client-generated UUID |
| drink | text | Drink name |
| emoji | text | Emoji symbol (optional) |
| color | text | CSS color (optional) |
| amount | integer | Amount in ml |
| ts | bigint | Unix timestamp in ms |
| date | text | `new Date().toDateString()` format |
| created_at | timestamptz | Raw date |
| source | text | 'dropsync' |

### `user_settings`
| Column | Type | Description |
|---|---|---|
| user_id | uuid PK | Supabase auth user ID |
| goal_ml | integer | Water goal in ml (default: 2500) |
| updated_at | timestamptz | Last update (for workout sync) |
| calorie_goal | integer | Daily calorie goal (default: 2000) |
| protein_goal | integer | Protein goal in g (default: 0 = no goal) |
| carbs_goal | integer | Carb goal in g |
| fat_goal | integer | Fat goal in g |
| workout_routines | jsonb | Workout plans as JSON |

---

## localStorage Keys (Complete Reference)

| Key | Content | Type |
|---|---|---|
| `calsync_v1` | Array of all food entries | `FoodEntry[]` JSON |
| `dropsync_v3` | Array of all drink entries | `DrinkEntry[]` JSON |
| `calsync_goal` | Daily calorie goal | Number as string |
| `calsync_goal_protein` | Protein goal in g | Number as string |
| `calsync_goal_carbs` | Carb goal in g | Number as string |
| `calsync_goal_fat` | Fat goal in g | Number as string |
| `dropsync_goal` | Water goal in ml | Number as string |
| `calsync_goal_ml` | Alias for water goal (used by `auth.js` `pullWaterGoal`, identical to `dropsync_goal`) | Number as string |
| `healthsync_workouts` | Workout plans + `_updated_at` | JSON |
| `calsync_onboarding_done` | Onboarding already seen | `'1'` |
| `calsync_ai_enabled` | AI tips enabled | `'true'` / `'false'` |
| `calsync_ai_api_key` | Gemini API key | String |
| `calsync_ai_terms_accepted` | AI terms of use accepted | `'true'` |
| `calsync_theme` | Active theme | Theme string |
| `dropsync_theme` | Active theme (mirror) | Theme string |
| `calsync_first_name` | First name for personalized header greeting | String |
| `cookieSettings` | Cookie consent settings (JSON with `thirdparty` boolean) | JSON |

---

## Login Page (`/login`)

The login page is a standalone route within the Next.js project. It is also used for account management (via `?keep_login_page=true`).

**Views (as React state):**
- `'login'` — email + password, forgot password link
- `'register'` — name, email, password (with strength indicator), confirm password
- `'mfa'` — 6-digit OTP input
- `'setup2fa'` — QR code (QRCode.js), secret key, OTP verification, optional disable
- `'reset'` — email input for reset link
- `'resetMfa'` — MFA verification before password reset
- `'confirm'` — confirmation hint after registration
- `'loggedIn'` — success view with redirect timer and optional 2FA setup

**Password strength:** 3 bars (`#bar1`, `#bar2`, `#bar3`). Classes: `weak` (1 bar), `medium` (2 bars), `strong` (3 bars). Rules: min. 8 characters, min. 1 uppercase letter, min. 1 number.

**OTP input:** 6 individual `<input type="number">` fields. Auto-advance, backspace jump-back, paste support.

**After login:** redirect to `/?reload=true`. The `reload` parameter triggers a `window.location.replace` without the parameter after ~2.2 seconds, so the app initializes fresh.

---

## Particularities and Gotchas

### `date` Format
Entries use `new Date().toDateString()` as the `date` field (e.g. `"Mon Jun 09 2025"`). Not ISO format. All date comparisons in the dashboard and DropSync work with this format. Do not change.

### `ts` Field
Unix timestamp in milliseconds (`Date.now()`), stored as `bigint` in Supabase. Used for sorting and "X ago" displays.

### `entry_id` vs `id`
In Supabase, entries have an auto-generated `id` (UUID). The client-generated ID is stored in `entry_id`. In localStorage, the client UUID is the primary key (`entry.id`). On sync operations, always join on `entry_id`, not `id`.

### `updateCaloriePreview`
This function is registered on the manual input fields in `onboarding.js` within the DOMContentLoaded listener. It is defined in `script.js` (CalSync). In the Next.js version, it must be exported from CalSync and made available in the onboarding component via ref or context.

### Double `updateUI`
In `dropsync-integration.js` there is a local `updateUI` function. In `dashboard.js` there is also an `updateUI` function. These are completely independent and must not refer to the same name in React.

### `window.reload` trick after login
After successful login, users are redirected to `/?reload=true`. `page.tsx` checks this parameter on mount and performs `window.location.replace('/')` after a short delay (2200ms from `auth.js`) — this ensures auth state and localStorage are cleanly initialized without keeping the parameter in the URL.

### `removeHeaderBtn` / `addHeaderBtn`
`settings.js` hides the settings buttons in the view headers when opening the settings modal. In React: `settingsOpen` boolean state that gives the buttons conditional `display: none`.

### `syncUserSettingsToCloud`
Defined in `settings.js` (not in `auth.js`). Called after every goal change. Internally calls `pushUserSettings`. In Next.js: `pushSettings` from `sync.ts` called directly from settings components.

### `checkAndNotifyMissingMacros`
Called in `initAuth` after auth success and after login change. Checks if macro goals are missing and shows a toast if needed. In Next.js: call after `fetchSettings` in the `AuthContext`.

### Double `updateUI` (AI Tips)
`ai-tips.js` has an internal `updateUI(title, text)`. `script.js` has a global `updateUI()`. `dropsync-integration.js` has its own. In React, no problem — they all live in separate components.

### `escapeHTML`
In `menu.js` as `window.escapeHTML` for workout routine names in innerHTML. Irrelevant in React (JSX escapes automatically).

### `window.entries`
In `menu.js`, on pull-to-refresh `window.entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]')` is set. A global cache that `script.js` uses as data source. In React: a state in the CalSync context.

### `calsync_goal_ml` vs `dropsync_goal`
`auth.js` uses `calsync_goal_ml` in `pullWaterGoal` and `ensureUserSettings`. `settings.js` uses `dropsync_goal`. Both point to the same value. In Next.js, normalize to `dropsync_goal` and mirror `calsync_goal_ml` as an alias on pull.

