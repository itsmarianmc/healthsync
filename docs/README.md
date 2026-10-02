# HealthSync – Technical Documentation

This documentation describes the checked-in HealthSync code and configuration as inspected on **October 2, 2026**. It is intended for developers, maintainers, rebuilds, and coding agents. The working tree contains application and documentation changes; inspect `git status --short` before relying on them as a released state. Only `20261002010000_profile_newsletter_preferences.sql` is present under `supabase/migrations/` in this checkout. `AGENTS.md` and older audit notes contain maintainer-reported rollout status for other migration files and Supabase projects; those reports are not independent evidence, and the referenced files/database state are not available for verification here.

## Purpose

HealthSync is a mobile-first Progressive Web App for:

- calorie and macro tracking (CalSync)
- hydration tracking (DropSync)
- workout routines and workout sessions
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

