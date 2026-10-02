# HealthSync – Technical Documentation

This documentation describes the HealthSync codebase as it exists in the repository on **October 1, 2026**. It is intended for developers, maintainers, rebuilds, and coding agents. The maintainer reports that the security/sync migration was applied successfully to the cloned development project and that checks performed so far pass; a later Delete All Data run exposed a `supplements_taken` constraint mismatch, for which an additive SQL hotfix is documented. This is not evidence of a production rollout or completion of every account-isolation acceptance test.

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
3. `supabase/migrations/` for versioned SQL changes and `hosting.md` for the base Supabase schema and deployment notes
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
| `/login` | Login, registration, MFA, password reset and account management |
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

