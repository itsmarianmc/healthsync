# HealthSync

A mobile-first Progressive Web App for personal health tracking. HealthSync combines calorie counting, hydration tracking and workout logging in a single, unified interface that feels like a native app in the browser. HealthSync is a personal project and part of [itsmarian](https://github.com/itsmarianmc)'s projects.

Project site: [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)

---

## Features

**Dashboard**
A daily overview with a weighted health score, calorie and water progress bars, macro tracking, a 7-day bar chart, recent activity feed, and a rule-based next-step suggestion. Includes optional weather information and activity status tracking. Dashboard health data is calculated from browser-local storage.

**CalSync - Food Tracking**
Log meals via free-text search, barcode scanning (ZXing / Open Food Facts), or manual entry. Macro rings show daily protein, carbs, and fat progress. Entries sync to the cloud when logged in.

**DropSync - Hydration Tracking**
A two-step bottom sheet: pick a drink, then set the amount by dragging a glass up or down. Snap points at common volumes (100 to 1000 ml). Swipe to close, pull up to expand. A history sheet shows all entries grouped by date.

**Workouts**
Built-in 4-day split (Pull / Push / Legs / Arms) with editable routines, drag-to-reorder exercises and per-exercise GIF previews. Live session timer, per-set weight and reps logging, and a history view of finished sessions.

**Settings**
Goals for calories, water and macros. A built-in calorie calculator using the Mifflin-St-Jeor formula. Workout routines with a live session timer and per-set logging. Optional AI Detection settings with the user's Gemini API key. Multiple themes.

**AI Detection (opt-in)**
Optional Google Gemini integration inside CalSync to estimate nutrition from a photo, camera capture or text description. Disabled by default, uses the user's own API key, never proxies through the HealthSync backend. See the in-app [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines) for details.

**Update Center**
In-app update notifications and changelog browser. Shows what's new in each version and allows seamless one-tap updates when using the PWA. Powered by a local JSON changelog.

**Auth**
Email and password login with TOTP two-factor authentication when configured for the account. Registration, password reset, and password change flows are available. Verified-factor accounts must complete the MFA challenge before protected access. The Supabase SSR browser client stores session state in cookies.

**Account**
Signed-in users can view account details, manage their password and authenticator, and set a newsletter preference. The preference does not send email; no mailing service is connected by this feature.

**Offline & PWA**
Installable on supported browsers via the browser's add-to-home-screen prompt. Core tracking works without an account and stores entries in browser-local storage. Signed-in users can synchronize data with Supabase.

**Pull-to-refresh, haptics & sheet system**
Native-style pull-to-refresh, drag-to-dismiss / drag-to-expand bottom sheets with snap points, and short haptic feedback where browser support is available. Main sections are separate Next.js routes.

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
| Testing | Node.js test runner (unit), Playwright (E2E) |
| Deployment | Vercel (default) - any Node.js host works |

---

## Legal & Compliance

HealthSync includes legal pages reachable from the in-app footer. Operators should review them against their actual deployment, processing activities and applicable law:

- [Privacy Policy](https://healthsync.itsmarian.dev/legal/privacy) - includes a dedicated **Health data (Art. 9 GDPR)** section.
- [Cookie Policy](https://healthsync.itsmarian.dev/legal/cookies) - documents cookies, browser storage and Google Consent Mode v2.
- [Terms of Use](https://healthsync.itsmarian.dev/legal/terms) - acceptable use, no-medical-advice, liability.
- [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines) - what AI may and must not be used for, plus risks and your responsibilities.

HealthSync is **not** a medical device. It does not provide medical advice and must not be used as a substitute for professional health consultation.

The repository defines `npm test`, `npm run test:watch`, and `npm run test:e2e` for Node and Playwright suites, plus `npm run lint` and `npm run build`. These are available commands, not claims that checks have passed. The GitHub Playwright workflow is currently disabled with `if: false`.

---

## Project Structure

```
src/app/
├── layout.tsx              # Root layout and providers
├── page.tsx                # Redirects / to /dash
├── dash/ food/ drinks/     # Separate feature routes
├── login/ onboarding/      # Account and first-run flows
├── legal/ support/         # Public information routes
├── api/                    # Session verification and account deletion
├── _components/            # Shared shell, dashboard and feature UI
├── _context/ _hooks/ _lib/ # State, reusable hooks, local data and integrations
└── sw.ts                   # Serwist Service Worker
supabase/migrations/        # Versioned SQL changes
tests/                      # Node.js unit tests
e2e/                        # Playwright browser tests
docs/                       # Technical architecture and operational guide
```

---

## Self-Hosting

HealthSync can be self-hosted on Vercel, any Node.js host, or in Docker. The current application code uses Supabase Auth and the Supabase client; SQLite would require implementing and wiring a separate backend. `hosting.md` documents Supabase setup and includes an illustrative SQLite porting outline.

> See [hosting.md](./hosting.md) for the complete self-hosting and deployment guide.

---

## Documentation

- [AGENTS.md](./AGENTS.md) - canonical repository orientation for coding agents.
- [docs/README.md](./docs/README.md) - current technical documentation index.
- [hosting.md](./hosting.md) - Supabase schema/RLS setup, deployment, backups and hardening.
- [FUNCTIONALITY.md](./FUNCTIONALITY.md) - historical feature reference; some sections describe the former Vanilla-JS app and may be outdated.

---

## License

MIT


<h1></h1>
<p align="center">
    <span>&copy; 2026 HEALTHSYNC via <a href="https://github.com/itsmarianmc/">itsmarian</a> | All rights reserved.</span>
</p>
