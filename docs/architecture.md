# Architecture and Runtime

## Overview

```text
Browser / installed PWA
        |
        v
Next.js App Router
        |
        +--> RootLayout
        |      +--> AuthProvider
        |      +--> AppShellProvider
        |      +--> AppShell
        |      +--> global Tooltip / CookieBanner / AnalyticsTracker
        |
        +--> route-specific client page
        |      +--> Dashboard
        |      +--> CalSync
        |      +--> DropSync
        |      +--> Login / Onboarding / Support / Legal
        |
        +--> Local Storage (offline-first UI data)
        +--> Supabase Auth + PostgreSQL (signed-in users only)
        +--> external services (consent- and feature-dependent)
```

The application feels like an SPA, but is technically composed of several Next routes. Shared navigation, bottom sheets and many modals live in the global `AppShell`.

## Boot and render order

1. `src/app/layout.tsx` sets metadata, the manifest, global CSS, fonts, Font Awesome, the Analytics consent default and the optional splash screen.
2. `AuthProvider` reads the Supabase session and continuously listens to `onAuthStateChange`.
3. `AppShellProvider` owns global modal and menu state.
4. `AppShell` decides whether global navigation and modals are shown for the current path. For unknown or non-main-app paths it renders only the route children.
5. The route-specific client page loads entries from `localStorage`, registers events and renders its feature components.
6. When a session exists, `AuthContext` starts one cloud sync per user ID.

The first render must remain SSR-safe. Access to `window`, `document`, `navigator` and `localStorage` belongs in client components or guarded effects.

## Provider and shell tree

```text
RootLayout
└── AuthProvider
    └── AppShellProvider
        └── AppShell
            ├── AiDetectionProvider
            ├── PullToRefresh
            ├── BottomNav
            ├── global extra-action menu
            ├── route children
            ├── UpdateCenter
            ├── SettingsModal
            ├── NotesModal
            ├── WorkoutModal
            ├── WorkoutHistoryModal
            ├── SupplementsModal
            ├── BarcodeSearchPopup
            └── Toast
```

Important files:

- [layout.tsx](../../src/app/layout.tsx) – global HTML, providers and external assets
- [AppShell.tsx](../../src/app/_components/AppShell.tsx) – route-aware shell, footer, global modals and extra menu
- [AuthContext.tsx](../../src/app/_context/AuthContext.tsx) – session, toast queue and cloud sync
- [AppShellContext.tsx](../../src/app/_context/AppShellContext.tsx) – global open/close state
- [AiDetectionContext.tsx](../../src/app/_context/AiDetectionContext.tsx) – running AI detections and resume behavior

## Route pages and feature boundaries

Route pages are thin adapters. They read query parameters, optionally open a feature modal and pass callbacks:

- `dash/page.tsx` renders `Dashboard`.
- `food/page.tsx` renders `CalSync` and translates `openModal`, `mode` and `openAiMethod` into props.
- `drinks/page.tsx` renders `DropSync` and translates `openModal` into an opening signal.
- `onboarding/page.tsx` stores completion and then navigates to `/dash`.
- `login/page.tsx` is a standalone auth/account flow.
- Legal pages and Support are not treated as main-app views.

The visible section is therefore not switched by an internal `view` state machine. `BottomNav` navigates with `next/link` between `/dash`, `/food` and `/drinks`; `viewChanged` is only an internal refresh event.

## State sources

| State type | Source | Examples |
|---|---|---|
| UI modal state | React context/state | Settings, Workout, Barcode, Update Center |
| Feature data | `localStorage` | Food, drinks, goals, routines |
| Auth identity | Supabase session in cookies | `user`, `loading` |
| Cloud data | Supabase tables | Entries, settings, workout sessions |
| Consent | `cookieSettings` in `localStorage` | Analytics, preferences, third party |
| Update/changelog state | `localStorage` + Service Worker | waiting worker, last-seen version |

The Dashboard hook [useDashboardData.ts](../../src/app/_hooks/useDashboardData.ts) reads directly from Local Storage and reacts to `storage`, `focus`, `viewChanged`, `visibilitychange` and a 30-second interval. Dashboard rendering must not depend on a successful Supabase request.

## Data flow for a change

```text
User action
  -> feature component updates React state
  -> local JSON is written
  -> local `storage` event is dispatched
  -> Dashboard / affected components reload
  -> if `user` exists: asynchronous Supabase write
  -> UI remains usable on cloud failure; errors are logged
```

This is intentionally optimistic. A cloud failure normally does not roll back the local change. Sync functions are centralized in [sync.ts](../../src/app/_lib/sync.ts); some workout routine writes also use direct Supabase code in the workout modal.

## Internal events

| Event | Producer | Consumer / purpose |
|---|---|---|
| `storage` | feature components, `useLocalStorage`, consent | local data and UI refresh |
| `viewChanged` | `BottomNav` | reload Dashboard/DropSync on tab changes |
| `onboarding:done` | onboarding page | tells AppShell onboarding is complete |
| `extra:openBarcodeSearch` | CalSync | opens the global barcode/search popup |
| `navigate:food` | AI/feature flows | requests a Food modal |
| `healthsync:update-available-changed` | Update Center/Settings | synchronizes update indicators |
| `cookieSettingsChanged` | Cookie UI | refreshes consent hooks |
| `__showTooltip` | tooltip triggers | shows/hides the global tooltip |

## Modals and sheets

`useDraggableSheet.ts` is the common mechanism for bottom sheets. It manages closed, open and expanded states, pointer/touch dragging, overlay clicks, Escape, focus and optional persisted expansion (`healthsync_modals_expanded`).

In a rebuild, a sheet must not be implemented as an ordinary dialog only: the current UX depends on drag-to-close, drag-to-expand, focus management and header buttons that are hidden while a modal is open.

## Styling and assets

- App styling is primarily in [styles.css](../../src/app/styles.css), consent styling in `cookiebanner.css`, login styling in `login/styles.css` and legal styling in `legal/legal.css`.
- The app uses DM Sans plus external global variable/color CSS files.
- Font Awesome is loaded externally; ZXing is loaded as a global browser script from `layout.tsx`.
- `public/exercises.json` is a large static exercise catalog; `public/changelog.json` is the Update Center source.

## Security and runtime boundaries

- Client code uses only `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key.
- The server route `/api/account/delete` is the only code path allowed to use `SUPABASE_SERVICE_ROLE_KEY`.
- `/api/sync/verify` verifies the access token server-side before cloud sync functions continue.
- [proxy.ts](../../src/proxy.ts) sets CSP, frame/content-type/referrer headers and a Permissions Policy.
- Camera, geolocation, third-party requests and AI are capability- and consent-dependent.

