# Guide 1: Code Refactoring

This guide covers how to refactor the existing HealthSync codebase to align with the Next.js 16 best practices defined in `copilot-instructions.md` before the routing migration begins. Do not start the routing migration until this refactoring is complete.

---

## Why Refactor First

The current codebase was migrated 1:1 from vanilla JS into a single `page.tsx`. Most logic lives in one file, components are mixed in the same scope, and there is no clear boundary between server and client code. Now that the site features three different pages `/dashboard` `` ``, there needs to be any sort of system.

---

## Step 1: Enforce TypeScript Strict Mode

Open `tsconfig.json` and confirm:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./*"] }
  }
}
```

Run `npx tsc --noEmit` and fix all type errors before continuing. Do not suppress errors with `// @ts-ignore` — fix them properly. This is the baseline that makes every subsequent step reliable.

---

## Step 2: Resolve the Folder Structure

The current structure has components mixed with app route files. Align it to the convention from `copilot-instructions.md`:

```
app/
├── layout.tsx
├── page.tsx
├── styles.css
├── login/
│   ├── layout.tsx
│   └── page.tsx
├── _lib/           <- shared utilities, Supabase client, sync functions
├── _context/       <- React context providers
├── _hooks/         <- custom React hooks
└── _components/
    ├── shared/
    ├── navigation/
    ├── dashboard/
    ├── calsync/
    ├── dropsync/
    ├── settings/
    ├── notes/
    └── onboarding/
```

**Naming rules from `copilot-instructions.md`:**

- Component files: `PascalCase` (e.g., `ScoreRing.tsx`)
- Hook files: `camelCase` (e.g., `useDashboardData.ts`)
- Folder names: `kebab-case` (e.g., `_components/`)
- Context providers named `XyzProvider` (e.g., `AuthProvider`)
- TypeScript interfaces and types: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

Check every file in `_components/` against these rules and rename where needed.

---

## Step 3: Audit and Separate Server from Client Components

Every component that uses any of the following must have `'use client'` at the top:

- `useState`, `useReducer`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useContext`
- `localStorage`, `window`, `document`, `navigator`
- Event handlers (`onClick`, `onChange`, `onPointerDown`, etc.)
- Supabase browser client (`createBrowserClient`)
- Any hook from `_hooks/`

In HealthSync, this means nearly all components are Client Components. That is expected and fine. The key rule from `copilot-instructions.md`:

> Never use `next/dynamic` with `{ ssr: false }` inside a Server Component.

Audit every file for any `next/dynamic` usage. If found, replace it: move the client-only logic into a dedicated Client Component and import it directly.

**The only true Server Components in HealthSync are:**

- `app/layout.tsx` — metadata, font loading, root HTML structure
- `app/login/layout.tsx` — loads QRCode.js script tag

Everything else is `'use client'`.

---

## Step 4: Refactor `_lib/` Files

### `supabase.ts`

Must use `createBrowserClient` from `@supabase/ssr`. No `createClient` from `@supabase/supabase-js` for auth. The client is a singleton exported directly:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### `types.ts`

All interfaces must be `PascalCase`. Check that every interface used across multiple components is defined here and not duplicated inline. Key interfaces that must exist:

- `FoodEntry`
- `DrinkEntry`
- `UserSettings`
- `MacroGoals`
- `DayData`
- `DashboardData`
- `WorkoutSession`
- `Database` (Supabase schema)

### `sync.ts`

All Supabase CRUD functions live here. No Supabase calls anywhere else except `AuthContext`. Each function takes `userId` as a parameter — no global state. Functions are named clearly:

```typescript
export async function pullFoodFromCloud(userId: string): Promise<FoodEntry[]>
export async function pushFoodToCloud(userId: string, entry: FoodEntry): Promise<void>
export async function deleteFoodFromCloud(userId: string, entryId: string): Promise<void>
export async function pullDrinksFromCloud(userId: string): Promise<DrinkEntry[]>
export async function pushDrinkToCloud(userId: string, entry: DrinkEntry): Promise<void>
export async function deleteDrinkFromCloud(userId: string, entryId: string): Promise<void>
export async function pushSettings(settings: UserSettings): Promise<void>
export function mergeEntries<T extends { id: string; ts: number }>(cloud: T[], local: T[]): T[]
```

---

## Step 5: Refactor `_context/AuthContext.tsx`

The AuthContext is the single source of truth for auth state. It must not contain any UI logic. Its interface:

```typescript
interface AuthContextType {
  user: User | null
  syncEnabled: boolean
  loading: boolean
  settings: UserSettings | null
  refreshSettings: () => Promise<void>
  logout: () => Promise<void>
}
```

After `fetchSettings` resolves, call `checkAndNotifyMissingMacros()` — the function that toasts when macro goals are unset. This replaces the old `initAuth` pattern from `auth.js`.

Mirror cloud settings to localStorage inside `fetchSettings` — not in any component:

```typescript
localStorage.setItem('calsync_goal', String(data.calorie_goal ?? 2000))
localStorage.setItem('calsync_goal_protein', String(data.protein_goal ?? 0))
localStorage.setItem('calsync_goal_carbs', String(data.carbs_goal ?? 0))
localStorage.setItem('calsync_goal_fat', String(data.fat_goal ?? 0))
localStorage.setItem('dropsync_goal', String(data.goal_ml ?? 2500))
localStorage.setItem('calsync_goal_ml', String(data.goal_ml ?? 2500))
```

---

## Step 6: Refactor `_hooks/`

Each hook must have a single, clearly defined responsibility.

### `useDashboardData.ts`

Contains all logic from the original `dashboard.js`: `readList`, `readGoal`, `clamp01`, `sum`, `entryDate`, `todayString`, `calculateStreak`, `getWeekData`, `combinedEntries`. Returns a typed `DashboardData` object. No DOM access. No `document.getElementById`. Pure calculation from localStorage.

Re-renders on `storage` events, `focus` events, `viewChanged` custom events, and a 30-second interval:

```typescript
useEffect(() => {
  window.addEventListener('storage', refresh)
  window.addEventListener('focus', refresh)
  window.addEventListener('viewChanged', refresh)
  const id = setInterval(refresh, 30000)
  return () => {
    window.removeEventListener('storage', refresh)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('viewChanged', refresh)
    clearInterval(id)
  }
}, [])
```

### `useDraggableSheet.ts`

Encapsulates the drag logic shared by Settings, Notes, GoalModal, and DropSync. Takes a config object with refs and callbacks:

```typescript
interface DraggableSheetConfig {
  modalRef: React.RefObject<HTMLElement>
  overlayRef: React.RefObject<HTMLElement>
  onClose: () => void
}

export function useDraggableSheet(config: DraggableSheetConfig) {
  // returns: handlePointerDown, sheetState, openSheet, closeSheet
}
```

### `useOnboarding.ts`

```typescript
export function useOnboarding() {
  // returns: done, finish, reset
}
```

---

## Step 7: Split `page.tsx`

The current `page.tsx` likely contains hundreds of lines of inline JSX for all three views, all modals, and the navigation. Extract every section into its component file.

After refactoring, `page.tsx` should look like this:

```tsx
'use client'

import { useState } from 'react'
import { BottomNav } from './_components/navigation/BottomNav'
import { Dashboard } from './_components/dashboard/Dashboard'
import { CalSync } from './_components/calsync/CalSync'
import { DropSync } from './_components/dropsync/DropSync'
import { SettingsModal } from './_components/settings/SettingsModal'
import { Onboarding } from './_components/onboarding/Onboarding'
import { Toast } from './_components/shared/Toast'
import { SplashScreen } from './_components/shared/SplashScreen'
import { PullToRefresh } from './_components/shared/PullToRefresh'

type View = 'dashboard' | 'calsync' | 'dropsync'

export default function HealthSyncPage() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <>
      <SplashScreen />
      <Onboarding />
      <PullToRefresh />
      <Toast />

      {view === 'dashboard' && <Dashboard />}
      {view === 'calsync' && <CalSync />}
      {view === 'dropsync' && <DropSync />}

      <SettingsModal />
      <BottomNav activeView={view} onViewChange={setView} />
    </>
  )
}
```

No inline logic. No event listeners. No localStorage reads. This file is a compositor only.

---

## Step 8: Eliminate All `window.*` Globals

The vanilla JS codebase communicated between files via `window.*` properties. These must all be replaced:

| Old global | Replacement |
|---|---|
| `window.currentUser` | `useAuth().user` |
| `window.syncEnabled` | `useAuth().syncEnabled` |
| `window.showToast(msg)` | `useToast().show(msg)` or a toast context |
| `window.refreshDropsyncUI()` | `useEffect` storage event in DropSync |
| `window.refreshAITip` | `useCallback` ref passed to AiTips |
| `window.showOnboarding` | exported `reset()` from `useOnboarding` |
| `window.entries` | CalSync state |
| `window.isAIReady` | read directly from localStorage in AI section |
| `window.escapeHTML` | not needed in JSX |
| `window.lastKcalResult` etc. | local state in GoalModal |
| `window.loadRoutinesFromStorage` | Workout context or local state |
| `window.closeToolTip` / `window.showToolTip` | exported functions from Tooltip component |

After this step, `grep -r "window\." app/` should return only legitimate browser API calls (`window.innerHeight`, `window.addEventListener`, `navigator.vibrate`) — no patched globals.

---

## Step 9: Remove Example and Dead Code

Per `copilot-instructions.md` section 9:

> Do not create example/demo files in the main codebase.

Remove any files created during migration testing that are not production components. This includes any `*Example.tsx`, `*Test.tsx`, or `*Demo.tsx` files.

Also remove any commented-out code blocks that are longer than 3 lines. If code is not used, it should not be in the codebase.

---

## Step 10: Verify the Refactored Build

Before moving to Guide 2, confirm:

```bash
npx tsc --noEmit        # zero TypeScript errors
npm run build           # zero build errors
npm run dev             # app runs and all three views work correctly
```

Also manually verify:
- Login, logout, and MFA work
- Food entries save and sync
- Drink entries save and sync
- Dashboard score calculates correctly
- Settings save and persist after reload
- Onboarding appears on first visit and can be re-triggered

Only proceed to Guide 2 once all of the above passes.
