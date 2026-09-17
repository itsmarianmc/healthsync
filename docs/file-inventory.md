# File Inventory

This inventory describes the currently relevant files. Historical copies under `.history/` are not runtime sources and are not listed individually.

## Repository root

| File | Purpose |
|---|---|
| `AGENTS.md` | agent work rules and project description |
| `CLAUDE.md` | additional agent/project instructions |
| `README.md` | user and developer overview |
| `FUNCTIONALITY.md` | detailed, partly historical feature description |
| `hosting.md` | self-hosting, Supabase SQL, RLS, Docker and operations |
| `CHANGELOG.md` | human-maintained change log |
| `checklist.md` | general security review checklist |
| `.env.example` | environment variable template |
| `.gitignore` | ignored build, secret and test files |
| `package.json` | dependencies and actual npm scripts |
| `package-lock.json` | reproducible npm dependency lockfile |
| `tsconfig.json` | strict TypeScript configuration and `@/*` alias |
| `next.config.ts` | Next configuration including Serwist/Turbopack |
| `eslint.config.mjs` | ESLint configuration |
| `postcss.config.mjs` | PostCSS configuration |
| `playwright.config.ts` | Playwright browser, base URL and web server setup |

## `src/app` – Next App Router

| Path | Purpose |
|---|---|
| `layout.tsx` | global layout, metadata, providers, consent default and external scripts |
| `page.tsx` | root redirect to `/dash` |
| `error.tsx` | route error boundary |
| `global-error.tsx` | global error boundary |
| `not-found.tsx` | 404 presentation |
| `sitemap.ts` | sitemap routes |
| `styles.css` | global app design |
| `cookiebanner.css` | cookie banner styling |
| `sw.ts` | Serwist Service Worker and offline catch handler |
| `favicon.ico` | app favicon |

### Pages and route handlers

| Path | Purpose |
|---|---|
| `dash/page.tsx` | Dashboard adapter, query refresh, navigation to Food/Drinks |
| `food/page.tsx` | CalSync adapter, query- and event-driven modal opening |
| `drinks/page.tsx` | DropSync adapter, query-driven modal opening |
| `onboarding/page.tsx` | onboarding completion and redirect |
| `login/page.tsx` | login, registration, MFA, reset and account management |
| `support/page.tsx` | support form and external submission |
| `legal/privacy/page.tsx` | privacy policy content |
| `legal/cookies/page.tsx` | cookie/consent content |
| `legal/terms/page.tsx` | terms content |
| `legal/ai-guidelines/page.tsx` | AI guidelines |
| `legal/legal.css` | legal layout styling |
| `legal/components/*` | reusable legal layout, lists, sections, scroller, links and back-to-top components |
| `api/sync/verify/route.ts` | server-side token/user verification |
| `api/account/delete/route.ts` | authorized full account deletion |
| `serwist/[path]/route.ts` | generated Service Worker route |

## `_components` – UI and feature components

### App and Dashboard

| File | Purpose |
|---|---|
| `AppShell.tsx` | global shell, footer, extra menu and global modals |
| `dashboard/Dashboard.tsx` | Dashboard composition |
| `dashboard/ScoreRing.tsx` | score SVG |
| `dashboard/MetricGrid.tsx` | calorie/water metrics |
| `dashboard/MacroGrid.tsx` | macro progress |
| `dashboard/WeekChart.tsx` | weekly bars |
| `dashboard/RecentList.tsx` | recent entries |
| `dashboard/NextWidget.tsx` | rule-based next step |
| `dashboard/AiTips.tsx` | local rule-based tips |
| `dashboard/ActivityStatus.tsx` | activity status and duration |
| `dashboard/WeatherWidget.tsx` | location, reverse geocoding and weather |

### CalSync

| File | Purpose |
|---|---|
| `calsync/CalSync.tsx` | food state, Local Storage, delete/undo and drafts |
| `calsync/CalSyncModal.tsx` | manual/search/AI input and amount confirmation |
| `calsync/FoodList.tsx` | daily list and draft/delete actions |
| `calsync/CalHistoryModal.tsx` | food history |
| `calsync/MacroRings.tsx` | macro rings |
| `calsync/BarcodeSearchPopup.tsx` | Open Food Facts search, barcode flow and amount confirmation |
| `calsync/BarcodeScanner.tsx` | camera/ZXing lifecycle |
| `calsync/AiMethodModal.tsx` | text/image/camera method selection |
| `calsync/AiDetectionIndicator.tsx` | running AI detection and navigation |

### DropSync

| File | Purpose |
|---|---|
| `dropsync/DropSync.tsx` | daily data, ring, Local Storage and cloud writes |
| `dropsync/DropSyncModal.tsx` | two-step hydration sheet |
| `dropsync/DrinkPicker.tsx` | drink type |
| `dropsync/GlassInput.tsx` | drag/snap amount selection |
| `dropsync/DrinkLog.tsx` | daily list |
| `dropsync/HistoryModal.tsx` | grouped history |

### Settings and Workouts

| File | Purpose |
|---|---|
| `settings/SettingsModal.tsx` | goals, themes, consent-dependent settings, export and account |
| `settings/WorkoutModal.tsx` | routines, catalog, sessions, timer, sets and PRs |
| `settings/WorkoutHistoryModal.tsx` | local workout history |
| `settings/SupplementsModal.tsx` | supplement goals and daily status |
| `settings/NotesModal.tsx` | license/source notes |
| `settings/ReportBugModal.tsx` | bug-report subdialog |

### Onboarding, navigation, shared and update

| File | Purpose |
|---|---|
| `onboarding/Onboarding.tsx` | onboarding slides |
| `onboarding/Tooltip.tsx` | tour/tooltip positioning |
| `navigation/BottomNav.tsx` | main navigation |
| `shared/Toast.tsx` | toast queue rendering |
| `shared/PullToRefresh.tsx` | mobile pull-to-refresh gesture |
| `shared/CookieBanner.tsx` | consent banner and settings |
| `shared/AnalyticsTracker.tsx` | analytics tracking under consent |
| `shared/SplashScreen.tsx` | app splash state |
| `shared/HeaderTitle.tsx` | header name/greeting |
| `shared/Footer.tsx` | footer links |
| `shared/Tooltip.tsx` | global tooltip overlay |
| `update/UpdateCenter.tsx` | worker update, banner and changelog |

## `_context` – global React contexts

| File | Contract |
|---|---|
| `AuthContext.tsx` | `user`, `syncEnabled`, `loading`, settings, logout, toast queue and cloud sync |
| `AppShellContext.tsx` | open/close state for Settings, Update, Notes, Workouts, Supplements, Barcode and extra menu |
| `AiDetectionContext.tsx` | detection lifecycle, results, resume and pending auto-open |

## `_hooks` – reusable logic

| File | Purpose |
|---|---|
| `useDashboardData.ts` | local Dashboard aggregation and refresh events |
| `useLocalStorage.ts` | typed Local Storage hook with storage event |
| `usePendingFoodDraft.ts` | active AI draft and TTL |
| `useOnboarding.ts` | onboarding marker |
| `useDraggableSheet.ts` | shared sheet gesture, snap, focus and close |

## `_lib` – domain and integration logic

| File | Purpose |
|---|---|
| `types.ts` | central TypeScript domain types |
| `sync.ts` | Supabase auth verification, CRUD, merge and workout sync |
| `supabase.ts` | browser Supabase client |
| `gemini.ts` | image preparation, Gemini request, JSON sanitizing and mapping |
| `analytics.ts` | Google Analytics measurement ID |
| `camera.ts` | camera constraints and friendly errors |
| `location.ts` | Nominatim reverse geocoding |
| `changelog.ts` | changelog parsing and local version keys |
| `release.ts` | `APP_VERSION` from `package.json` |
| `ids.ts` | client ID generators |
| `supplements.ts` | supplement calculation and persistence |
| `useCookieConsent.ts` | consent state, storage and listeners |
| `headerBtns.ts` | show/hide header buttons |
| `tour.ts` | onboarding/tooltip tour control |
| `visitedRoutes.ts` | in-memory marker for visited main pages |

## Other source areas

| Path | Purpose |
|---|---|
| `src/proxy.ts` | CSP and security headers |
| `src/lib/logger.ts` | central logger for sensitive integrations |

## `public`

| File | Purpose |
|---|---|
| `manifest.json` | PWA metadata, icons and shortcuts |
| `offline.html` | offline navigation fallback |
| `changelog.json` | local Update Center data |
| `exercises.json` | workout exercise catalog |
| `logo.svg` | logo asset |
| `favicon.ico`, `favicon.png` | icons |
| `robots.txt` | crawler rules |
| `llms.txt` | machine-readable project/site notes |

## `e2e`

| File | Purpose |
|---|---|
| `global-setup.ts` | checks central routes before tests |
| `onboarding.spec.ts` | onboarding flow |
| `onboarding-steps.spec.ts` | onboarding steps |
| `settings.spec.ts` | Settings behavior |
| `pull-to-refresh.spec.ts` | pull-to-refresh |
| `not-found.spec.ts` | 404 behavior |

