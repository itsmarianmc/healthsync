# HealthSync – Technical Documentation

This documentation describes the checked-in HealthSync code and configuration,
with the v5.0.0 local food library updated on **October 26, 2026**. Inspect
`git status --short` before treating working-tree changes as released.
`supabase/migrations/` contains only the newly prepared, unapplied
`20261026010000_custom_foods.sql`; Web Push and historical baseline/security
migrations described in older notes are absent from this checkout. Repository
files do not establish any external database state.

## Purpose

HealthSync is a mobile-first Progressive Web App for:

- calorie and macro tracking (CalSync)
- hydration tracking (DropSync)
- workout routines and workout sessions
- daily supplement tracking with custom weekday and interval schedules
- optional cloud synchronization with Supabase
- optional AI nutrition detection through a user-provided Gemini key

The app is offline-first: domain data is written to the browser first. Signed-in users can additionally synchronize with Supabase.

## Recommended reading order

1. [`AGENTS.md`](../AGENTS.md) — concise repository guide for all agents.
2. [Architecture and runtime](./architecture.md)
3. [Routing, navigation and contracts](./routing-and-contracts.md)
4. [Data model and storage](./data-model-and-storage.md)
5. [Feature behavior](./features.md)
6. [Agent and rebuild guide](./agent-guide.md)
7. [Operations, development and tests](./operations-and-testing.md)
8. [Security migration runbook](./security-migration.md)
9. [Known gaps and technical notes](./known-gaps.md)
10. [Quality audit status](./quality-audit.md)
11. [Web Push v1, migration and Vercel setup](./web-push.md)
12. [Automatic reminder preparation and required security approval](./web-push-reminders.md)

The [file inventory](./file-inventory.md) is a quick index for concrete files.

## Source of truth

When documentation and implementation differ, use this order:

1. current code under `src/`
2. `package.json`, `next.config.ts`, `playwright.config.ts` and `.env.example`
3. SQL files actually present under `supabase/migrations/`, plus `hosting.md` for the documented reference schema and deployment notes. A reference schema is not proof that a target database has that schema.
4. this documentation
5. older documents such as `FUNCTIONALITY.md` when they describe the former Vanilla-JS structure

Every behavior description should point to the responsible source file. Changes to routing, data formats, Local Storage keys, Supabase tables or external integrations must update the relevant documentation in the same change.

## Quick start

```bash
npm install
cp .env.example .env
# fill in the Supabase values in .env
npm run dev
```

The app is normally available at `http://localhost:3000`. The actual npm scripts are listed in [operations-and-testing.md](./operations-and-testing.md) and `package.json`.

## Main routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dash` |
| `/dash` | Dashboard |
| `/food` | CalSync |
| `/drinks` | DropSync |
| `/onboarding` | First-time setup |
| `/login` | Login, registration, MFA and password reset |
| `/account` | Signed-in account overview, security status and newsletter preference |
| `/support` | Support form |
| `/legal/privacy` | Privacy policy |
| `/legal/cookies` | Cookie and consent information |
| `/legal/terms` | Terms of use |
| `/legal/ai-guidelines` | AI guidelines |

## Rebuild principles

- Preserve data formats and keys unless an explicit migration is planned.
- Treat timestamps as milliseconds and retain the existing `Date.toDateString()` format.
- Do not treat cloud data as the only source of truth: visible UI state is based on Local Storage.
- Keep client and server responsibilities separate. Never expose the `service_role` key to client code.
- Call external services only where the current code does, while preserving consent and capability boundaries.
- Document new events, query parameters and storage keys as internal public contracts.

