# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [3.1.1] - 2026-08-05

### Fixed
- **Text-based food detection** (`CalSyncModal.tsx`): description analysis now routes
  through Gemini using the same URL and API key as image/camera detection, replacing
  the Ollama-based `analyzeWithPillama` path that depended on the `/api/proxy?type=pillama`
  endpoint disabled by default in 3.1.0.

## [3.1.0] - 2026-08-05

### Added
- **Back-camera selection helpers** (`src/app/_lib/camera.ts`) that prefer the main
  back camera over the ultrawide/telephoto, so close-up barcodes focus and scan
  correctly on multi-camera phones.
- **Shared changelog helpers** (`src/app/_lib/changelog.ts`) for caching the
  "last seen" version locally and syncing it to Supabase only when the local
  version is higher.
- **Supabase env validation** (`src/app/_lib/supabase.ts`): throws a clear error
  at startup if `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
  missing, instead of relying on TypeScript `!` assertions.
- **OpenFoodFacts nutrition validation** (`CalSyncModal.tsx`, `ExtraScanner.tsx`):
  `toFiniteNumber` guards ensure malformed or missing API fields can't produce
  `NaN`/`Infinity` values in stored food entries.

### Fixed
- **Update flow**: clicking "Update" now saves the new version to the local cache
  first, and after a successful update the local version is compared with Supabase
  and synced up only when local is higher. The "What's new" popup no longer stays
  open and unresponsive after the page reloads.
- **Reliable post-update reload**: the page now reloads after the update whether
  it was triggered from the update banner or the Settings screen (shared
  `pending-reload` flag consumed by the `controllerchange` handler).
- **Barcode scanner focus**: the scanner no longer starts on the ultrawide camera,
  which focused on distant subjects and made close-up codes unscannable.
- **Stored-XSS surface**: changelog descriptions and AI-tip titles are now rendered
  as plain text instead of via `dangerouslySetInnerHTML`.
- **Removed stray debug logging**: `console.log` calls that dumped raw AI/Gemini
  responses (including user food data) in production were removed.

### Security
- **Content-Security-Policy completed** (`src/proxy.ts`): the allow-list now covers
  every origin the app actually uses — Supabase (incl. websockets), `api.itsmarian.dev`,
  Google Gemini, OpenFoodFacts, Nominatim, Google Analytics, and
  `static.itsmarian.dev` styles/fonts — and adds `object-src 'none'`.
- **Ollama AI proxy disabled by default** (`src/app/api/proxy/route.ts`): returns
  `404` unless `ENABLE_OLLAMA_PROXY=true`, removing an unauthenticated relay to the
  local LLM.
- **Supply-chain hardening**: `@zxing/browser` is pinned to `@0.2.1` with a
  Subresource Integrity hash + `crossOrigin="anonymous"` + `defer`, so a modified
  CDN payload is refused by the browser.

### Changed
- **Accessibility**: removed `maximumScale: 1` and `userScalable: false` from the
  viewport meta, re-enabling pinch-to-zoom.
- **Dead UI removed**: the never-acting "Switch Camera" button (and its unused
  `switchCamera` / `cameraIndexRef`) was removed from the barcode scan modal; the
  camera dropdown remains for multi-camera selection.
- **Docs**: `hosting.md` now documents the default-disabled `/api/proxy` behavior
  and the new `ENABLE_OLLAMA_PROXY` flag.

## [3.0.0] - 2026-07-09

### Changed
- Improved the in-app update flow and removed the redundant update button from
  the update popup for a cleaner update experience.
- Updated secondary-muscle tracking for workout exercises.

### Fixed
- Barcode scanner camera improvements for more reliable code detection.
- Various bug fixes, style adjustments, and proxy / Playwright test updates.

## [2.1.1] - 2026-07-01

### Added
- New in-app Update Center showing the latest updates and changelog.
- New exercises with instruction steps and a redesigned workout experience.
- Secondary-muscle tracking for workout exercises.
- Reverse geocoding on the weather widget for readable location names.

### Changed
- Performance enhancements, bug fixes, and visual improvements.

## [0.1.0] - 2026-06-10

### Added
- Initial HealthSync release: dashboard with health score, macro and hydration
  tracking, food logging (CalSync), hydration tracking (DropSync), workouts,
  and multiple themes.
- Weather widget and activity status tracking.
- AI detection for food descriptions via a self-hosted LLM.
- Supplement tracking, food favourites, workout break timer and PR tracking.
- Legal pages (privacy, cookies, terms, AI guidelines).
- Various fixes including CSV data export and cookie banner handling.
