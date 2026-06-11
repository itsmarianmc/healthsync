# Guide 2: Routing Migration

This guide covers splitting the single-page HealthSync app into three proper Next.js routes — `/dashboard`, `/food`, and `/drinks` — and correctly preserving UI state across navigations using React's `Activity` component as documented in `preserving-ui-state.md`.

Complete Guide 1 entirely before starting this guide.

---

## Overview

**Before:** All three views render conditionally in a single `app/page.tsx` controlled by a `view` state variable.

**After:** Each section is its own route:

```
/           -> redirects to /dashboard
/dashboard  -> Dashboard view
/food       -> CalSync view
/drinks     -> DropSync view
/login      -> Login (unchanged)
```

The bottom navigation uses `next/link` with `router.push` for instant client-side transitions. Because `cacheComponents: true` is enabled, Next.js uses React's `Activity` component under the hood to preserve state across routes — the drink modal scroll position, form drafts, and the active workout session timer all survive navigation.

---

## Step 1: Enable Cache Components

Open `next.config.ts` and add:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

This is required for `Activity`-based state preservation. Without it, navigating between routes unmounts the previous page and all state is lost. With it, Next.js keeps up to 3 routes alive (hidden with `display: none`) and only evicts the oldest when a fourth is visited.

---

## Step 2: Create the Route Folder Structure

```
app/
├── layout.tsx              <- root layout (unchanged, still wraps AuthProvider)
├── page.tsx                <- redirect to /dashboard
├── styles.css              <- unchanged
├── dashboard/
│   ├── page.tsx            <- Dashboard view
│   └── layout.tsx          <- optional, only if dashboard needs unique metadata
├── food/
│   └── page.tsx            <- CalSync view
├── drinks/
│   └── page.tsx            <- DropSync view
└── login/
    ├── layout.tsx          <- unchanged
    └── page.tsx            <- unchanged
```

---

## Step 3: Update Root `app/page.tsx`

The root route redirects immediately to `/dashboard`:

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

---

## Step 4: Create the Route Pages

Each route page imports its top-level component. These are thin files — no logic, just imports.

**`app/dashboard/page.tsx`:**

```tsx
import { Dashboard } from '@/_components/dashboard/Dashboard'

export const metadata = {
  title: 'Dashboard — HealthSync',
}

export default function DashboardPage() {
  return <Dashboard />
}
```

**`app/food/page.tsx`:**

```tsx
import { CalSync } from '@/_components/calsync/CalSync'

export const metadata = {
  title: 'Food — HealthSync',
}

export default function FoodPage() {
  return <CalSync />
}
```

**`app/drinks/page.tsx`:**

```tsx
import { DropSync } from '@/_components/dropsync/DropSync'

export const metadata = {
  title: 'Drinks — HealthSync',
}

export default function DrinksPage() {
  return <DropSync />
}
```

---

## Step 5: Update the Root Layout

`app/layout.tsx` is the persistent shell. It must render on every route. All elements that should appear regardless of which route is active belong here:

```tsx
import type { ReactNode } from 'react'
import { AuthProvider } from './_context/AuthContext'
import { BottomNav } from './_components/navigation/BottomNav'
import { SettingsModal } from './_components/settings/SettingsModal'
import { Toast } from './_components/shared/Toast'
import { SplashScreen } from './_components/shared/SplashScreen'
import { PullToRefresh } from './_components/shared/PullToRefresh'
import { Onboarding } from './_components/onboarding/Onboarding'
import './styles.css'

export const metadata = {
  title: 'HealthSync',
  description: 'Personal health tracking',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SplashScreen />
          <Onboarding />
          <PullToRefresh />
          {children}
          <SettingsModal />
          <BottomNav />
          <Toast />
        </AuthProvider>
      </body>
    </html>
  )
}
```

`children` is the active route's page. `BottomNav`, `SettingsModal`, `Toast`, and `Onboarding` render on every route without re-mounting.

---

## Step 6: Refactor BottomNav for Routing

The old `BottomNav` used `data-view` attributes and `switchView()` to toggle CSS classes on view `<div>`s. In the routing version, it uses `next/link` and derives the active tab from the current pathname.

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const TABS = [
  { href: '/dashboard', view: 'dashboard', index: 0 },
  { href: '/food', view: 'calsync', index: 1 },
  { href: '/drinks', view: 'dropsync', index: 2 },
]

export function BottomNav() {
  const pathname = usePathname()
  const sliderRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)

  const activeIndex = TABS.findIndex(t => pathname.startsWith(t.href))
  const safeIndex = activeIndex === -1 ? 0 : activeIndex

  useEffect(() => {
    updateSliderPosition(safeIndex)
    // Dispatch viewChanged so Dashboard and other components refresh
    window.dispatchEvent(new CustomEvent('viewChanged', {
      detail: { view: TABS[safeIndex].view }
    }))
  }, [safeIndex])

  function updateSliderPosition(index: number) {
    const nav = navRef.current
    const slider = sliderRef.current
    if (!nav || !slider) return
    const translateX = index * 103.5
    slider.style.transform = `translateX(${translateX}%) scale(1)`
    slider.style.background = 'rgba(58, 58, 60, 0.5)'
    slider.style.borderTop = '0px'
    slider.style.borderBottom = '0px'
  }

  function handleNavClick(index: number) {
    animateSliderPulse(index)
  }

  function animateSliderPulse(index: number) {
    const nav = navRef.current
    const slider = sliderRef.current
    if (!nav || !slider) return
    const translateX = index * 103.5
    slider.style.transform = `translateX(${translateX}%) scale(1.2)`
    slider.style.borderTop = '1px solid var(--border)'
    slider.style.borderBottom = '1px solid var(--border)'
    slider.style.background = 'rgba(58, 58, 60, 0.25)'
    nav.style.transform = 'scale(1.025)'
    setTimeout(() => {
      if (!nav || !slider) return
      nav.style.transform = 'scale(1)'
      slider.style.transform = `translateX(${translateX}%) scale(1)`
      slider.style.background = 'rgba(58, 58, 60, 0.5)'
      slider.style.borderTop = '0px'
      slider.style.borderBottom = '0px'
    }, 150)
  }

  return (
    <nav id="bottomNav" ref={navRef}>
      <div className="nav-slider" ref={sliderRef} />
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`nav-btn${safeIndex === tab.index ? ' active' : ''}`}
          data-view={tab.view}
          data-index={tab.index}
          onClick={() => handleNavClick(tab.index)}
        >
          {/* icon content stays identical to original */}
        </Link>
      ))}
    </nav>
  )
}
```

Key points:
- `usePathname()` determines the active tab — no state needed
- `next/link` handles prefetching and client-side navigation
- The `viewChanged` custom event still fires so `useDashboardData` and AiTips continue to work
- The slider animation logic is preserved 1:1

---

## Step 7: Handle UI State Preservation with Activity

With `cacheComponents: true`, Next.js automatically wraps each route in `<Activity>` and preserves up to 3 routes simultaneously. This means navigating from `/drinks` to `/dashboard` and back to `/drinks` keeps the DropSync modal state, glass drag position, and current amount intact.

However, some state in HealthSync should **reset** on navigation, and some should **persist**. The following patterns from `preserving-ui-state.md` apply directly.

### Modals and sheets that should close on navigation

The DropSync modal, HistoryModal, and SettingsModal should close when the user navigates away. Use `useLayoutEffect` cleanup:

```tsx
'use client'

import { useState, useLayoutEffect } from 'react'

export function DropSyncModal() {
  const [sheetState, setSheetState] = useState<'closed' | 'open' | 'expanded'>('closed')

  // Close the sheet when this route becomes hidden via Activity
  useLayoutEffect(() => {
    return () => {
      setSheetState('closed')
    }
  }, [])

  // ...rest of component
}
```

Apply the same pattern to `HistoryModal`, `SettingsModal`, `NotesModal`, and `GoalModal`. Using `useLayoutEffect` instead of `useEffect` ensures the cleanup runs synchronously before the component is hidden, preventing a flash of the open modal when the route becomes visible again.

### The active workout session timer should persist

The workout session timer is an exception — the user should be able to navigate to `/food` to log a meal mid-session and return to `/drinks` or `/dashboard` with the timer still running. Because Activity preserves state, the `setInterval` from the timer's `useEffect` pauses automatically (the cleanup runs on hide) and resumes when the route becomes visible again:

```tsx
useEffect(() => {
  if (!sessionActive) return
  const id = setInterval(() => setElapsed(e => e + 1), 1000)
  return () => clearInterval(id) // pauses when Activity hides the route
}, [sessionActive])
```

No special handling needed — this is Activity working as intended.

### Form inputs in CalSync should persist

Search inputs, quantity fields, and any open food search results in CalSync should be preserved when the user navigates to `/drinks` and back. Activity handles this automatically because they are controlled React state. Do nothing — this is the desired behavior.

### The add-entry modal in CalSync should close on navigation

```tsx
'use client'

import { useState, useLayoutEffect } from 'react'

export function CalSyncModal() {
  const [isOpen, setIsOpen] = useState(false)

  useLayoutEffect(() => {
    return () => {
      setIsOpen(false)
    }
  }, [])

  // ...
}
```

### Dialogs that run initialization logic

The barcode scanner in CalSync runs initialization logic (requesting camera permission, starting the ZXing stream) when the modal opens. If the user navigated away with the scanner open, Activity preserves `isScannerOpen: true`. When they return and try to open the scanner again, `isScannerOpen` is already `true` so the `useEffect` does not re-run and the camera does not reinitialize.

Fix this by deriving scanner state from a URL search param:

```tsx
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function BarcodeScanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isScannerOpen = searchParams.get('scan') === 'true'
  const scannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isScannerOpen) {
      initZXingScanner(scannerRef.current)
    }
    return () => {
      stopZXingScanner()
    }
  }, [isScannerOpen])

  return (
    <>
      <button onClick={() => router.push('/food?scan=true')}>Scan Barcode</button>
      {isScannerOpen && (
        <div ref={scannerRef} className="barcode-scanner-container" />
      )}
    </>
  )
}
```

When the user navigates away, the URL changes and `isScannerOpen` becomes `false`, stopping the scanner. When they return and open it again, the param is set again, `isScannerOpen` changes from `false` to `true`, and the Effect re-runs and reinitializes the camera.

---

## Step 8: Update Internal Navigation References

Search the codebase for any remaining references to the old view-switching pattern and replace them:

| Old pattern | New pattern |
|---|---|
| `document.querySelector('.nav-btn[data-view="dashboard"]')?.click()` | `router.push('/dashboard')` |
| `document.querySelector('.nav-btn[data-view="calsync"]')?.click()` | `router.push('/food')` |
| `document.querySelector('.nav-btn[data-view="dropsync"]')?.click()` | `router.push('/drinks')` |
| `switchView('dashboard', 0)` | `router.push('/dashboard')` |
| `views[viewId].classList.add('active')` | handled by Next.js routing |
| `window.dispatchEvent(new CustomEvent('viewChanged', ...))` | keep this, BottomNav dispatches it |

The `openViewAndButton` function from `dashboard.js` (which clicked a nav button then immediately clicked another button) becomes:

```typescript
async function openViewAndButton(href: string, buttonId: string) {
  await router.push(href)
  requestAnimationFrame(() => {
    document.getElementById(buttonId)?.click()
  })
}
```

The Quick Add buttons (`quickAddCal`, `quickAddWater`) on the dashboard use this pattern to navigate to `/food` or `/drinks` and open the respective modal.

---

## Step 9: Update the Login Redirect

The login page currently redirects to `/?reload=true`. Update it to `/dashboard?reload=true`:

```typescript
// in app/login/page.tsx
const urls: Record<string, string> = {
  healthsync: '/dashboard',
}
router.push((urls[appKey] || '/dashboard') + '?reload=true')
```

In `app/dashboard/page.tsx`, handle the reload param on mount:

```tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Dashboard } from '@/_components/dashboard/Dashboard'

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('reload') === 'true') {
      setTimeout(() => {
        router.replace('/dashboard', { scroll: false })
      }, 2200)
    }
  }, [])

  return <Dashboard />
}
```

`router.replace` removes the `reload` param from the URL without adding a history entry.

---

## Step 10: Verify the Routing Migration

```bash
npm run build   # must pass with zero errors
npm run dev     # manual testing
```

Test the following manually:

**Navigation:**
- Each tab in the bottom nav navigates to the correct URL
- The active tab indicator correctly reflects the current route
- Browser back and forward buttons work as expected
- Direct URL access (`/food`, `/drinks`, `/dashboard`) loads the correct view

**State preservation (Activity):**
- Open the DropSync modal, navigate to `/dashboard`, navigate back — the modal is closed
- Type something in the CalSync food search, navigate to `/drinks`, navigate back — the search text is preserved
- Start a workout session timer, navigate to `/food`, navigate back — the timer was paused and resumes
- Open the barcode scanner, navigate away and return — the scanner reopens correctly when triggered again

**Auth:**
- Login redirects to `/dashboard`
- Logout from settings redirects correctly
- `?keep_login_page=true` still works for account management

**Sync:**
- Adding a food entry on `/food` and navigating to `/dashboard` shows the entry in the recent list
- Adding a drink on `/drinks` and navigating to `/dashboard` updates the water progress bar
