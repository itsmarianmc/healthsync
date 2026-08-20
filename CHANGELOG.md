# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

### [4.0.0] - 2026-08-20 [BETA 3]

### Added
- **Better error screens**: If something goes wrong, you now see a clear message with a "Try again" button instead of a blank page.
- **Pending food drafts**: AI-detected foods now appear as pending drafts in your history with a clear indicator, so you can review and confirm them before they're saved.
- **AI detection survives app reloads**: New `usePendingFoodDraft()` hook (`src/app/_hooks/usePendingFoodDraft.ts`) persists the active AI detection as a single-slot draft under the `calsync_active_draft` localStorage key (7-day TTL) as soon as the result completes while the CalSync modal is open. On next mount, `CalSync.tsx` restores the draft into the modal (prefill + auto-open) with a "Restored pending AI detection" toast, and clears it in `handleModalClose` so logging or dismissing removes it. A shared `resultToFoodSearchResult()` helper dedupes the food-mapping logic between `handleDetectionResolved` and the auto-save path.
- **Legal pages redesign**: Privacy, Terms, Cookies, and AI Guidelines pages have been completely redesigned with better readability, per-theme accent colors, and a scroll-linked table of contents.
- **Account deletion**: Settings now has a "Delete Account" button backed by a new `POST /api/account/delete` route (in `src/app/api/account/delete/route.ts`). The route verifies the requesting user via the anon client with their `accessToken`, then uses the Supabase service-role key to purge `calsync_entries`, `dropsync_entries`, `user_settings`, and `workout_sessions` for the user before deleting the auth account.
- **Sign-out confirmation**: `AuthContext.logout()` now accepts an optional `clearData: boolean` flag and a new `.logout-modal` sheet (`SettingsModal.tsx`) drives the flow. A checkbox lets the user clear every HealthSync localStorage key (25 keys total) on - **SPA page view tracking**: New `AnalyticsTracker.tsx` (mounted in `layout.tsx` next to `CookieBanner`) fires `gtag('event', 'page_view', { page_path })` on every client-side route change, so in-app navigation is visible in GA4 again. It skips the first mount to avoid double-firing the consent-time `page_view` that `gtag('config', …)` already sends.
the device as part of signing out.
- **AI Detection gating**: New `AiDetectionProvider` (`src/app/_context/AiDetectionContext.tsx`) exposes an `isAiDetectionUsable` flag derived from `calsync_ai_enabled` plus the presence of `calsync_ai_api_key`. When the key is missing or invalid, AI entry points are visually disabled with `aria-disabled` in:
  - the dashboard Quick Add grid (Describe Food / Import Food / Capture Food) in `AppShell.tsx`,
  - the CalSync AI button in `CalSync.tsx`,
  - the new `AiMethodModal.tsx` option cards.
- **Gemini key validation on save**: New `validateApiKey()` in `src/app/_lib/gemini.ts` calls `GET https://generativelanguage.googleapis.com/v1/models?key=…` to verify the key before `SettingsModal.handleSaveApiKey` persists it. Invalid keys now show "Invalid API key – please check and try again." and are not stored.
- **`POST /api/sync/verify`**: New server-side endpoint that accepts an `accessToken` + `userId`, validates the session with the anon client, and returns `{ ok: true }`. `src/app/_lib/sync.ts` adds a new `assertUserAuthorized(userId)` helper that all cloud push/pull/delete functions now call before issuing a Supabase request — `pushFoodEntriesToCloud`, `deleteFoodFromCloud`, `pullFoodFromCloud`, `syncDrinkToCloud`, etc.
- **`AiMethodModal.tsx` + `BarcodeSearchPopup.tsx`**: New components. `AiMethodModal` centralizes the photo / camera / text-description picker previously scattered across the CalSync modal; `BarcodeSearchPopup` replaces the old `BarcodeScanModal` + `ExtraScanner` pair (both deleted) and supports both free-text search and live camera scan. A new custom event `extra:openBarcodeSearch` (`{ mode: 'search' | 'camera' }`) drives the popup from anywhere in the app shell.
- **`AiDetectionIndicator.tsx`**: A small floating pill at the bottom of the screen that surfaces any active AI detection so the user can tap it to open the result. Mounted from `AppShell.tsx`.
- **`POST /api/account/delete`** infrastructure (see Account deletion above).
- **Report a Bug from Settings**: New `ReportBugModal.tsx` plus a "Report a Bug" button in the System section of `SettingsModal.tsx`. The modal embeds `https://itsmarian.dev/report` in an `<iframe>`, pre-filled via query params (`cnt_src=healthsync`, `user_id`, `app_version` from `APP_VERSION`, current path as `ref`, plus `hide_header`/`hide_footer`) and auto-expands via `sheet.snapToExpanded()`.

### Changed
- **Stronger account protection**: Two-factor authentication is now always required when you sign in - it can no longer be skipped on a device. Your synced data is also verified on the server before it is read or saved, ensuring only you can access it.
- **Updated Design for Supplements**: The supplements page has been redesigned for better usability and aesthetics and visual issues have been removed.
- **Quick Add now opens AI Detection**: The "+" button on the dashboard now opens the AI Detection menu (photo, camera, text) instead of directly opening the food log.
- **Legal pages use app theme colors**: Legal pages now adapt to your selected theme (Dark, Ocean, Forest, Sunset, Lavender, Light) with matching accent colors.
- **Improved onboarding tour**: The tour now highlights the AI Detection feature in the Quick Add menu.
- **Removed self-hosted LLM proxy**: The optional Ollama proxy for self-hosted AI has been removed.
- **Cookie preferences simplified**: The "Marketing" category is gone from `useCookieConsent.CookieSettings`, the Cookie Banner UI (`src/app/_components/shared/CookieBanner.tsx`) and `globalSettings` initial state. Google Consent Mode v2 fields `ad_storage`, `ad_user_data`, and `ad_personalization` are now hardcoded to `'denied'`. The `'canUseMarketing'` export was also removed.
- **Privacy policy refresh** (18 Aug 2026): new disclosures for Open-Meteo (weather provider), Nominatim (reverse geocoding), and `api.itsmarian.dev` (support API) added to `src/app/legal/privacy/page.tsx`; new `Right not to be subject to automated individual decision-making (Art. 22 GDPR)` section clarifying that the AI Detection feature is opt-in; new Supervisory authority note pointing at LfDI Rhineland-Palatinate; new Cookie Inventory table; GA4 retention lowered to "14 months". The "trusted devices" client-side list was removed entirely.
- **Cookie policy refresh** (18 Aug 2026): `src/app/legal/cookies/page.tsx` adds a Cookie Inventory table and matches the simplified preferences.
- **Weather widget goes direct to Open-Meteo**: `src/app/_components/dashboard/WeatherWidget.tsx` now `fetch()`es `https://api.open-meteo.com/v1/forecast?…` directly instead of routing through `api.itsmarian.dev/api/proxy`. Legacy `weather_*` localStorage keys are transparently migrated to the new `healthsync_weather_*` keys on first load.
- **Number-only validation on goal inputs**: New `sanitizeNumericSetting()` helper in `SettingsModal.tsx` rejects empty or non-numeric entries on the calorie/water goal fields and reverts the input to the previous value with a toast.
- **Settings sync uses partial payload**: `SettingsModal.syncSettings` builds a payload that only contains fields with a valid `parseInt` result. `_lib/sync.ts:ensureSettings` now does a check-then-insert against `user_settings` before issuing an upsert.
- **Cloud-to-local goal guards tightened**: `AuthContext.applySettingsToLocalStorage` switches all five goal fields (`calorie_goal`, `protein_goal`, `carbs_goal`, `fat_goal`, `goal_ml`) from `!== undefined && !== null` to `> 0`, so `NaN`/0/empty cloud values no longer clobber valid local settings.
- **Sync toast suppressed on `/login` and `/onboarding`**: `AuthContext.applySettingsToLocalStorage` checks the current pathname and skips the "Syncing…" toast when no user is signed in.
- **`@supabase/ssr` cookie hardening**: `_lib/supabase.ts`'s `createBrowserClient` now configures `cookieOptions: { secure: true, sameSite: 'lax', maxAge: 60*60*24*30 }`.
- **Middleware CSP allows Open-Meteo**: `src/proxy.ts` (Next.js 16 Turbopack middleware, the `proxy` named export) adds `https://api.open-meteo.com` to the `connect-src` allow-list and continues to set `Content-Security-Policy`, `Referrer-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Permissions-Policy` on every response.
- **Settings shows the running version**: the `App is up to date` line in `SettingsModal.tsx` now reads `App is up to date (v{APP_VERSION})`.
- **Tour copy update**: `DEFAULT_TOUR_STEPS` in `src/app/_lib/tour.ts` describes the Quick Add button as opening the "AI Detection menu". Tour steps whose target element is missing now log `[tour] step N element 'X' not found — skipping` and continue instead of silently aborting.
- **Settings stays open behind sub-windows**: `AppShell.tsx`'s `handleOpenNotesFromSettings` no longer calls `closeSettings()` before `openNotes()`, so "About & Licenses" opens on top of Settings instead of closing it. `SettingsModal.tsx` adds a `MutationObserver` that toggles `has-sub-modal` on the settings overlay whenever another `.app-overlay` becomes visible, and the new `.app-overlay.has-sub-modal .modal` rule in `styles.css` scales the sheet down (`scale: 0.92; translate: 0 10px`) behind the modal above it.
- **Collapsible About & Licenses sections**: `NotesModal.tsx` license-section titles are now clickable — `handleLicenseToggle` toggles a `.collapsed` class and animates the section body smoothly via `max-height` (measured with `body.scrollHeight`, released to `none` after expand) over `0.35s var(--ease)`; a chevron icon (`.license-arrow`) rotates over `0.15s` to reflect the collapsed state. `.license-section-title` gets `cursor: pointer; user-select: none`.

### Fixed
- **AI Detection disabled notice now actually displays**: `isAiDetectionUsable` was never passed to `AiMethodModal` (the prop defaulted to `true`), so the disabled message never rendered. `CalSync.tsx` now forwards the flag from `useAiDetection()`, and the notice (`#aiMethodDisabledNote`) was moved into the option grid with a dedicated "Open Settings" button (`#aiMethodOpenSettingsBtn`).
- **Settings no longer overlaps the AI Detection modal**: `AppShell.closeSettings` is now invoked when `AiMethodModal` opens (a `wasOpen` ref guards the transition so it only fires on closed→open), and explicit z-index layering was added in `styles.css` (`#settingsOverlay` `10001` → `#aiMethodOverlay` `10002`). The "Open Settings" button defers opening via a `pendingOpenSettings` ref inside the sheet's `onClose`, so the two overlays never coexist on screen.
- **Toasts stay above the AI Detection modal**: `.toast` z-index raised from `10001` to `10003`.
- **AI tip icons**: Dashboard tips now show their icons correctly instead of raw text.
- **Faster sign-in**: Signing in now takes you straight to your dashboard without extra page reloads.
- **Improved 2FA code entry**: Entering your six-digit authenticator code is now more reliable, especially on mobile.
- **Error Logging**: Fixed error logging for the AI detection feature.
- **Duplicate food entries from AI detection**: Fixed a bug where logging a food item via AI detection could create two identical entries instead of one.
- **Deleting pending AI drafts**: Fixed a bug where removing a pending AI detection draft would incorrectly remove other pending drafts that weren't selected.
- **Support page text size**: Increased font size for better readability on the support page.
- **AI text detection cleanup**: Closing the "Describe Food" text input without analyzing now properly closes the modal instead of leaving "Analyzing..." visible.
- **Barcode scanner camera release**: The camera now properly stops when closing the barcode scanner modal or switching away from the camera tab.
- **Barcode scanner console spam**: Fixed continuous "No MultiFormat Readers" error messages in the console when the scanner is idle.
- **Weather data source**: Updated to use Open-Meteo for weather information.
- **Drink "Clear all" now syncs to cloud**: `src/app/_components/dropsync/DropSync.tsx:handleClearAll` now `await`s `deleteDrinkFromCloud(e.id, user.id)` for every cleared entry. Previously only local state was cleared and the cloud kept the deleted entries.
- **GA4 measurement ID mismatch**: The gtag loader requested `G-EHN4P1ET7W` while the consent-time `gtag('config', …)` call targeted `G-2E9SPPVJFL`, silently sending analytics data to the wrong property. Both now share a single `GA_MEASUREMENT_ID` constant in `src/app/_lib/analytics.ts` (overridable via `NEXT_PUBLIC_GA_ID`, default `G-EHN4P1ET7W`).
- **Consent Mode `security_storage` override**: `CookieBanner.tsx` re-issued `gtag('consent', 'default', …)` with `security_storage: 'denied'`, overriding the `granted` default from `layout.tsx`. The redundant default calls were removed so the default now lives only in `layout.tsx` and fires `beforeInteractive` (the gtag loader moved to `afterInteractive`).
- **Charts and progress bars are screen-reader-friendly**: `WeekChart.tsx` chart container gets `role="img"` + summary `aria-label`; each bar gets its own `role="img"` and `aria-label`. `MetricGrid.tsx` calorie/water bars and `MacroGrid.tsx` protein/carbs/fat bars now expose `role="progressbar"` + `aria-valuenow`/`min`/`max` + `aria-label`. `ScoreRing.tsx` SVG gets `role="img"` + `aria-label="Daily progress: X%"`.
- **Settings toggles behave like switches**: All `app-toggle-switch` buttons in `SettingsModal.tsx` (`AI Detection`, `Weather`, `Delete warning`, `Splash screen`, `Open menus expanded`, `Track supplements`, `Display name on start`) now use `role="switch"` with `aria-checked` and a per-control `aria-label`.
- **Modals are real `role="dialog"` overlays**: `WorkoutModal.tsx`, `WorkoutHistoryModal.tsx`, `ActivityStatus.tsx`, `UpdateCenter.tsx`, and `SettingsModal.tsx`'s new logout + delete-account sheets now declare `aria-modal="true"` with a meaningful `aria-label`. Decorative icons/SVGs across these components get `aria-hidden="true"`.
- **Workout History log headers keyboard-operable**: `WorkoutHistoryModal.tsx`'s date-header previously became a `<button>` (element-type change); reverted to a `<div role="button" tabIndex={0} aria-expanded aria-controls onKeyDown>` so it stays keyboard-accessible without an element-type change.
- **Drink picker is keyboard-navigable**: `src/app/_components/dropsync/DrinkPicker.tsx` grid is now `role="radiogroup"` with Arrow-key navigation; each drink is `role="radio"` `aria-checked={…}` and icons get `aria-hidden="true"`.
- **Sheets close on Escape**: `useDraggableSheet` adds a `keydown` listener that calls `close()` when `Escape` is pressed and the sheet is open.
- **Focus-visible outline on form inputs**: `.form-input:focus-visible` in `src/app/styles.css` adds a 2px accent outline.
- **Better dark-theme contrast for dim text**: `--text3` raised from `rgba(255, 255, 255, 0.25)` to `rgba(255, 255, 255, 0.45)` (passes WCAG AA on the dark surface).
- **Save weather location now persists immediately**: `SettingsModal.tsx`'s location-fill handler writes `healthsync_weather_lat`/`lon`/`name` to localStorage directly, so the next Save doesn't drop the picked spot.
- **`Sync…` toast no longer leaks to `/login` or `/onboarding`**: the new `suppressToast` flag in `AuthContext.applySettingsToLocalStorage` keeps the toast off when there's no signed-in user.
- **Duplicate `id="backBtn"` resolved**: Modal back-buttons in `ActivityStatus.tsx`, `WorkoutHistoryModal.tsx`, and `UpdateCenter.tsx` were sharing the same DOM id. Renamed to `activityStatusBackBtn`, `keepStatusBackBtn`, `customDateBackBtn`, `updateCenterBackBtn` respectively.
- **AI Detection entry buttons no longer open a broken Gemini flow silently**: the Quick Add grid + CalSync AI button are now visibly disabled (with a tooltip-style explanation in `AiMethodModal`) when the API key is missing or invalid, instead of routing the user into a flow that would fail.
- **Invalid Gemini keys are no longer saved**: `SettingsModal.handleSaveApiKey` is now `async`, runs `validateApiKey()`, and returns early on validation failure.
- **Build & lint**: project still builds cleanly (`npm run build`, `tsc --noEmit`); lint baseline lifted from 229 → 236 by the seven `aria-*` attribute hooks introduced for the new `role="switch"` widgets (zero errors introduced).
- **Safe-area insets on notched devices**: Fixed UI now respects `env(safe-area-inset-*)` so nothing is hidden behind the notch, rounded corners, or home indicator on phones with a display cutout. Touched: cookie banner (`cookiebanner.css`), legal pages (`legal/legal.css` — `main` padding + back-to-top button), login screen (`login/styles.css`), app views, app-shell header, `.modal`/`.modal-footer` bottom padding, toast top, onboarding header (`styles.css`), and the support page inline padding (`src/app/support/page.tsx`). Each rule keeps a fallback value so browsers without `env()` support render as before.

## [3.1.2] - 2026-08-06

### Changed
- **Updated changelog**: The changelog has been updated to use a local JSON file for easier maintenance and to avoid issues with the Supabase backend.

## [3.1.1] - 2026-08-05

### Fixed
- **Improved food detection**: Food description analysis now works more reliably using your AI settings.

## [3.1.0] - 2026-08-05

### Added
- **Better barcode scanning**: The camera now automatically selects the best lens for scanning barcodes, making it faster and more reliable.
- **More reliable food logging**: Improved validation prevents errors when saving food items with unusual nutrition data.
- **Improved update process**: Updates now download and install more reliably, with clearer prompts.
- **Better barcode scanning reliability**: The scanner now focuses properly on close-up barcodes instead of starting on the wide-angle lens.
- **Enhanced security and privacy**: Improved security measures protect your data and prevent potential vulnerabilities.
- **Removed debug logging**: Removed internal diagnostic logging that could accidentally capture user data.
- **Improved accessibility**: Screen can now be zoomed in and out for better readability.
- **Removed non-functional button**: Removed the non-working 'Switch Camera' button from the barcode scanner.
- **Updated documentation**: Help documentation updated to reflect current app behavior.

## [3.0.0] - 2026-07-09

### Added
- **More exercises available**: Many new exercises have been added to the workout library.
- **Better exercise instructions**: Each exercise now includes detailed step-by-step instructions and form tips.
- **Support page**: Added a support page where you can report bugs or ask questions directly from the app settings.
- **Manual update option**: You can now manually check for and install updates from the settings menu.

### Changed
- **Improved update flow**: The update process is now smoother with fewer prompts and better reliability. Removed the redundant update button from the update popup for a cleaner update experience.
- **Clearer muscle targeting**: Workouts now clearly show which muscles are primarily worked and which are secondary (updated secondary-muscle tracking).
- **Weather shows location names**: The weather widget now displays your location name instead of just coordinates (reverse geocoding).
- **Redesigned workout interface**: Workout browsing and exercise selection has been redesigned for easier use.
- **Cleaner settings and interface**: The settings menu and barcode scanner have been simplified and streamlined.
- **Customizable privacy settings**: You can now control which features use cookies and tracking in settings.
- **Faster and smoother performance**: The app launches quicker and animations run more smoothly.

### Fixed
- **Calorie tracker scrolling**: Fixed an issue where the calorie tracking screen would scroll unexpectedly.
- Barcode scanner camera improvements for more reliable code detection.
- Various bug fixes, style adjustments, and proxy / Playwright test updates.

## [2.2.1] - 2026-06-25

### Added
- **Update Feature**: You can now see the latest news about the project on the dashboard when clicking the "<i class="fa fa-refresh"></i>" button

## [2.2.0] - 2026-06-20

### Added
- **Food Favourites**: You can now save and favourite foods. A new modal gives you quick access to previously logged meals.
- **New Logo**: The logo has been redesigned to better reflect the design and goals of the project.
- **Break Timer for Workouts**: A break timer is now integrated into workouts. You can add or remove 15 seconds from your rest time or skip breaks entirely.
- **PR Tracking**: The app now automatically notifies you when you hit a personal record during a workout.

### Changed
- **Improved Page Transitions**: Updated page switch animations for already rendered components to feel smoother.
- **Supplements Tracking Improvements**: Supplements tracking is now more precise. Also fixed a bug that occurred when tracking was disabled.
- **CSV Export Fix**: Fixed data export putting JSON into a single column instead of the correct CSV structure.
- **Hydration Rendering Fix**: Fixed a hydration mismatch where server-side defaults conflicted with client-side localStorage values.

## [2.1.1] - 2026-07-01

### Added
- New in-app Update Center showing the latest updates and changelog.
- New exercises with instruction steps and a redesigned workout experience.
- Secondary-muscle tracking for workout exercises.
- Reverse geocoding on the weather widget for readable location names.

### Changed
- Performance enhancements, bug fixes, and visual improvements.

## [2.1.0] - 2026-06-15

### Added
- **Supplement Tracking**: New feature to track your supplements including dosage and frequency.
- **Playwright Testing**: Added automated testing via Playwright for better stability across the app.
- **Cookie Banner Update**: The cookie banner no longer shows up once you have already accepted it.
- **Glass Animation**: Added a smooth animation to the glass when using quick buttons.
- **Merged Download Button**: CalSync and DropSync downloads are now combined into a single button.
- **AI Supplement Awareness**: The AI now has access to supplement information for better recommendations.
- **Removed Copilot Instructions**: Cleaned up unnecessary Copilot instruction files from the project.
- **Quick Button Fixes**: Fixed issues with quick buttons on the dashboard and a missing hidden button when opening the drink modal.
- **Supabase Column Fix**: Fixed intensity values being written to a non-existent column in Supabase.
- **Footer Content Fix**: Fixed footer content not loading correctly.

## [2.0.0] - 2026-06-10

### Added
- **PWA Update Banner**: Added a banner to notify you about available updates for the PWA version of the app.
- **Current Weather Widget**: Added a small weather widget to the dashboard showing current conditions for your location.
- **Activity Status**: Added a status widget to the dashboard where you can track your current activity status (active, resting, injured). Supports date-specific entries and can be used to filter your health data.
- **Changelog Sync**: You can now see the latest changes directly in the app. The changelog is synced with the GitHub repository.

## [1.1.0] - 2026-06-05

### Fixed
- **Bug Fixes and Improvements**: Fixed issues with AI detection for self-hosted LLMs, date handling, and language spelling errors.

## [1.0.0] - 2026-06-01

### Added
- **Initial Release**: HealthSync launches with CalSync for calorie tracking and DropSync for hydration tracking as its core features.

## [0.1.0] - 2026-05-15

### Added
- **Initial HealthSync release**: Dashboard with health score, macro and hydration tracking, food logging (CalSync), hydration tracking (DropSync), workouts, and multiple themes.
- Weather widget and activity status tracking.
- AI detection for food descriptions via a self-hosted LLM.
- Supplement tracking, food favourites, workout break timer and PR tracking.
- Legal pages (privacy, cookies, terms, AI guidelines).
- Various fixes including CSV data export and cookie banner handling.