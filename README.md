# HealthSync

A mobile-first Progressive Web App for personal health tracking. HealthSync combines calorie counting, hydration tracking and workout logging in a single, unified interface that feels like a native app in the browser. HealthSync is a personal project and part of [itsmarian](https://github.com/itsmarianmc)'s projects.

Live at [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)

---

## Features

**Dashboard**
A daily overview with a weighted health score, calorie and water progress bars, macro tracking, a 7-day bar chart, recent activity feed, and a rule-based next-step suggestion. Includes weather information and activity status tracking. Everything reads from local storage - no loading states, no spinners.

**CalSync - Food Tracking**
Log meals via free-text search, barcode scanning (ZXing / Open Food Facts), or manual entry. Macro rings show daily protein, carbs, and fat progress. Entries sync to the cloud when logged in.

**DropSync - Hydration Tracking**
A two-step bottom sheet: pick a drink, then set the amount by dragging a glass up or down. Snap points at common volumes (100 to 1000 ml). Swipe to close, pull up to expand. A history sheet shows all entries grouped by date.

**Workouts**
Built-in 4-day split (Pull / Push / Legs / Arms) with editable routines, drag-to-reorder exercises and per-exercise GIF previews. Live session timer, per-set weight and reps logging, and a history view of finished sessions.

**Settings**
Goals for calories, water and macros. A built-in calorie calculator using the Mifflin-St-Jeor formula. Workout routines with a live session timer and per-set logging. AI tip toggle with optional Gemini API key. Multiple themes (Dark, Light, Ocean, Forest, Sunset, Lavender).

**AI Detection (opt-in)**
Optional Google Gemini integration inside CalSync to estimate nutrition from a photo, camera capture or text description. Disabled by default, uses the user's own API key, never proxies through the HealthSync backend. See the in-app [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines) for details.

**Update Center**
In-app update notifications and changelog browser. Shows what's new in each version and allows seamless one-tap updates when using the PWA. Powered by Supabase-backed changelog.

**Auth**
Email and password login with optional TOTP two-factor authentication. Register, forgot password, and change password flows. "Remember this device" skips the 2FA step on trusted devices. Session tokens are stored in secure cookies (not localStorage).

**Offline & PWA**
Installable on mobile via the browser's add-to-home-screen prompt. Fully usable without an account - entries then live only in your browser's local storage. Cloud sync is opt-in via a free user account.

**Pull-to-refresh, haptics & sheet system**
Native-feeling pull-to-refresh from the top of the dashboard, drag-to-dismiss / drag-to-expand bottom sheets with snap points, and short haptic feedback on important interactions.

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS with CSS custom properties (no Tailwind for app styles) |
| Backend | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth with TOTP MFA, sessions via cookies |
| Font | DM Sans |
| Icons | Font Awesome 7 |
| Barcode | ZXing |
| AI (opt-in) | Google Gemini API (BYO key, called directly from the browser) |
| Testing | Playwright (E2E), Vitest |
| Deployment | Vercel (default) - any Node.js host works |

---

## Legal & Compliance

HealthSync ships with full GDPR-aligned legal pages, all reachable from the in-app footer:

- [Privacy Policy](https://healthsync.itsmarian.dev/legal/privacy) - includes a dedicated **Health data (Art. 9 GDPR)** section.
- [Cookie Policy](https://healthsync.itsmarian.dev/legal/cookies) - documents cookies, browser storage and Google Consent Mode v2.
- [Terms of Use](https://healthsync.itsmarian.dev/legal/terms) - acceptable use, no-medical-advice, liability.
- [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines) - what AI may and must not be used for, plus risks and your responsibilities.

HealthSync is **not** a medical device. It does not provide medical advice and must not be used as a substitute for professional health consultation.

---

## Project Structure

```
app/
├── layout.tsx              # Root layout: AuthProvider, global CSS, splash, GA Consent Mode v2
├── page.tsx                # App shell: view switching, all modals
├── styles.css              # Global styles + theme tokens
├── login/
│   ├── layout.tsx          # Loads QRCode.js for 2FA setup
│   └── page.tsx            # Full login, register, MFA, reset flows
├── legal/
│   ├── components/         # LegalLayout, LegalSection, LegalList, LegalEnumeration, Linkout, BackToTop, LegalScroller
│   ├── legal.css           # HealthSync-tokenised legal stylesheet
│   ├── privacy/page.tsx    # Privacy Policy
│   ├── cookies/page.tsx    # Cookie Policy
│   ├── terms/page.tsx      # Terms of Use
│   └── ai-guidelines/page.tsx  # AI Guidelines
├── api/
│   └── proxy/route.ts      # Edge-style proxy for the optional local AI endpoint
├── _lib/
│   ├── supabase.ts         # Supabase browser client
│   ├── types.ts            # TypeScript interfaces
│   └── sync.ts             # All Supabase CRUD functions
├── _context/
│   ├── AuthContext.tsx     # Auth state, user, settings, syncEnabled
│   └── AppShellContext.tsx # Cross-cutting UI state for the shell
├── _hooks/
│   ├── useDashboardData.ts # Dashboard calculations
│   ├── useDraggableSheet.ts # Shared sheet drag logic
│   ├── useLocalStorage.ts  # SSR-safe localStorage hook
│   └── useOnboarding.ts    # Onboarding state
└── _components/
    ├── shared/             # Toast, Tooltip, SplashScreen, PullToRefresh, CookieBanner, Footer
    ├── navigation/         # BottomNav with animated slider
    ├── dashboard/          # ScoreRing, MetricGrid, MacroGrid, WeekChart, RecentList, NextWidget, AiTips, WeatherWidget, ActivityStatus
    ├── calsync/            # CalSync view, modal, food list, barcode scanner, extra scanner
    ├── dropsync/           # DropSync view, modal, drink picker, glass input, history
    ├── settings/           # Settings sheet, goals, account, AI section, workout, supplements, notes
    ├── notes/              # Notes modal
    ├── onboarding/         # Onboarding slides and tooltip tour
    └── update/             # Update Center component for in-app updates and changelog
```

---

## Self-Hosting

HealthSync can be self-hosted on Vercel, any Node.js host, or in Docker, with either Supabase or a SQLite-backed DIY backend. The full setup walkthrough - prerequisites, environment variables, SQL schema, Row Level Security policies, authentication, optional AI integrations, deployment, backups and a hardening checklist - lives in a dedicated guide:

> See [hosting.md](./hosting.md) for the complete self-hosting and deployment guide.

---

## Documentation

- [hosting.md](./hosting.md) - full self-hosting guide (Supabase + SQLite, RLS, deployment, AI setup, testing).
- [FUNCTIONALITY.md](./FUNCTIONALITY.md) - detailed breakdown of the app's functionality, component structure, database schema, localStorage keys, and implementation notes.

---

## License

MIT


<h1></h1>
<p align="center">
    <span>&copy; 2026 HEALTHSYNC via <a href="https://github.com/itsmarianmc/">itsmarian</a> | All rights reserved.</span>
</p>
