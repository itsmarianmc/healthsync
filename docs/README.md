# HealthSync – Technical Documentation

This documentation describes the HealthSync codebase as it exists in the repository on **September 17, 2026**. It is intended for developers, maintainers, rebuilds, and coding agents.

## Purpose

HealthSync is a mobile-first Progressive Web App for:

- calorie and macro tracking (CalSync)
- hydration tracking (DropSync)
- workout routines and workout sessions
- optional cloud synchronization with Supabase
- optional AI nutrition detection through a user-provided Gemini key

The app is offline-first: domain data is written to the browser first. Signed-in users can additionally synchronize with Supabase.

## Recommended reading order

1. [Architecture and runtime](./architecture.md)
2. [Routing, navigation and contracts](./routing-and-contracts.md)
3. [Data model and storage](./data-model-and-storage.md)
4. [Feature behavior](./features.md)
5. [Agent and rebuild guide](./agent-guide.md)
6. [Operations, development and tests](./operations-and-testing.md)
7. [Known gaps and technical notes](./known-gaps.md)

The [file inventory](./file-inventory.md) is a quick index for concrete files.

## Source of truth

When documentation and implementation differ, use this order:

1. current code under `src/`
2. `package.json`, `next.config.ts`, `playwright.config.ts` and `.env.example`
3. `hosting.md` for the current Supabase schema and deployment notes
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

The app is normally available at `http://localhost:3000`. The actually available npm scripts are listed in [operations-and-testing.md](./operations-and-testing.md); older documents mention test scripts that are not currently defined in `package.json`.

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

