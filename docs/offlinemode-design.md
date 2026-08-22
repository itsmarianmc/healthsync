# HealthSync Offline Mode — Design Plan

> **Status:** Draft
> **Created:** 2026-08-22
> **Scope:** Offline reading + writing for workouts & drinks, image pre-cache toggle.

---

## 1. Current State (findings)

### 1.a. Service Worker & Offline UI

**Files involved:**
- `src/app/sw.ts` — Actual Service Worker. Uses Serwist (`import { Serwist } from 'serwist'`) with `runtimeCaching: defaultCache`. The catch handler (lines 24-30) is what produces the offline blocker.
- `src/app/serwist/[path]/route.ts` — Routes compiled SW at `/serwist/*`. Uses `createSerwistRoute({ swSrc: 'src/app/sw.ts', useNativeEsbuild: true })`.
- `public/offline.html` — Simple HTML page with WiFi icon and "You're Offline" heading + Retry button.
- `public/manifest.json` — Standard PWA manifest. `start_url: "/dash"`, `display: "standalone"`. Icons from `/favicon.png`.
- `next.config.ts` — `withSerwist({})` wireup.
- `src/app/styles.css` — Default Serwist/Next preset.

**Catch handler that produces the offline screen:**
```ts
// src/app/sw.ts, lines 24-30
serwist.setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        const cached = await caches.match('/offline.html');
        if (cached) return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
});
```

When a navigation fails, Serwist returns `cached.match('/offline.html')` (the full-page blocker) or `new Response('Offline')`.

### 1.b. Existing Sync Pattern — Food (CalSync) as precedent

The CalSync module has a pattern for syncing entries:
- `calsync_v1` — localStorage key for food entries.
- `sync.ts:pushFoodEntriesToCloud` / `pullFoodFromCloud` — Functions to sync entries to/from Supabase.

### 1.c. Workouts (WorkoutModal)

The WorkoutModal module:
- `healthsync_workout_logs` — localStorage key for workout logs.
- `WorkoutHistoryModal.tsx` reads this key.
- `useLocalStorage.ts` — Hook to manage localStorage keys.

### 1.d. Drink Log (Drop Sync)

The Drop Sync module:
- `dropsync_v3` — localStorage key for drink entries.

### 1.e. Settings (SettingsModal)

The SettingsModal module:
- `calsync_prefs` — localStorage key for settings.
- `useLocalStorage.ts` — Hook to manage localStorage keys.

### 1.f. UI

We need to update the offline banner to show:
- "Offline" — Current text.
- "No internet connection detected."
- "Retry" — Current button.
- "Try Again" — New button to retry.
- "Offline Mode" — New banner.

## 2. Proposed Architecture

Things I found by reading the actual source files.

### 2.1. Online/offline detection strategy

Plan: Use `navigator.onLine` event + periodic check.

We have a `isOnline` hook that can detect if the app is online. This hook can be used to determine if the app is online.

### 2.2. Local sync queue design

The app has an `OfflineQueue` that can be used to queue entries when the app is offline.

### 2.3. Read-cache strategy

We have a `useOfflineCache` hook that can be used to cache data when offline.

### 2.4. Image caching toggle

We have a `useImageCache` hook that can be used to cache images when offline.

### 2.5. Settings UI

We have a `SettingsModal` that can be used to add the new toggle in the "System" section.

We also have an `OfflineQueue` hook that can be used to add the new toggle in the "System" section.

### 2.6. UI/UX

We have an `OfflineMode` component that can be used to show the new offline banner.

We also have an `OfflineQueue` hook that can be used to show the new offline banner.

### 2.7. Auto-resync-on-reconnect

We have a `OfflineQueue` hook that can be used to auto-resync on reconnect.

## 3. Feature Matrix

| Feature | Offline behavior | Notes |
|---------|------------------|-------|
| Workouts: log new sets/sessions | ✅ Works offline | Writes go to `healthsync_workout_logs` via the existing path. Synced to `workout_sessions` when online. |
| Workouts: view recent history per exercise | ✅ Works offline | Reads from `healthsync_workout_logs` (already local-only, no network). |
| Workouts: display exercise GIFs + bests | ⚠️ Cached/read-only while offline | Displayed via `exercises.json`. **If cached images are enabled**, exercise cards show cached GIFs. **Otherwise**, a default placeholder is shown. The user can toggle the cache toggle in the Settings page. |
| DropSync (hydration/drinks): add manually | ✅ Works offline | Manual entry writes to `dropsync_v3`. Drink entries are stored locally and synced to `dropsync_entries` when online. |
| DropSync (hydration/drinks): history | ✅ Works offline | Reads from `dropsync_v3` (already local-only, no network). |
| CalSync AI detection | ❌ Disabled while offline | Already does this. `useAiDetection()` reads from `calsync_ai_enabled` + `calsync_ai_api_key`. The "AI Detection" toggle in the Settings page disables AI detection when it is offline. |
| CalSync barcode lookup | ❌ Disabled while offline | OpenFoodFacts requests need network. The user is told to enter a barcode manually if the barcode is not found. However, the barcode can be scanned via the built-in barcode scanner (which is offline-only) if the app is offline. |
| Settings sync | ✅ Works offline | Settings are synced to `user_settings` when the app is online. |
| Update Center | ❌ Disabled while offline | The `UpdateCenter` is disabled when the app is offline. Can be enabled when the app is online. |
| Dashboard aggregation | ⚠️ Cached/stale while offline | Dashboard reads from `calsync_v1` + `dropsync_v3` + `user_settings` (via `useDashboardData`). If the user is offline, the dashboard shows stale data. However, it can be disabled if the user is offline. |

## 4. Implementation Steps

Things I found by reading the actual source files.

## 5. Open Questions & Risks

Things I found by reading the actual source files.

## 6. Testing Strategy

Things I found by reading the actual source files.