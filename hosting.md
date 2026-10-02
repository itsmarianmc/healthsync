# Self-Hosting HealthSync

This guide walks you through hosting HealthSync on your own infrastructure.
HealthSync is a [Next.js 16](https://nextjs.org) App Router project whose
current authentication and cloud-data implementation uses
[Supabase](https://supabase.com) (PostgreSQL + Auth + RLS). The SQLite section
is a porting outline for a separately implemented backend; it is not a
drop-in or currently supported database option.

> HealthSync is part of [itsmarian](https://github.com/itsmarianmc)'s projects.
> Please review the in-app [Privacy Policy](https://healthsync.itsmarian.dev/legal/privacy),
> [Terms of Use](https://healthsync.itsmarian.dev/legal/terms) and
> [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines) before
> deploying a public instance - in particular the GDPR notes on **health data
> (Art. 9 GDPR)** and the AI opt-in flow.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & install](#2-clone--install)
3. [Environment variables](#3-environment-variables)
4. [Option A - Supabase (recommended)](#4-option-a--supabase-recommended)
   - [Create the project](#41-create-the-project)
   - [SQL schema & RLS policies](#42-sql-schema--rls-policies)
   - [Auth configuration](#43-auth-configuration)
   - [MFA / TOTP](#44-mfa--totp)
5. [Porting outline - SQLite (not supported as-is)](#5-porting-outline---sqlite-not-supported-by-this-repository-as-is)
6. [Optional: AI detection with Google Gemini](#6-optional-ai-detection-with-google-gemini)
7. [Development](#development-section-below)
9. [Production build & deployment](#9-production-build--deployment)
10. [Updating & migrations](#10-updating--migrations)
11. [Backups & data export](#11-backups--data-export)
12. [Hardening checklist](#12-hardening-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

- **Node.js** 20.9+ (Node 22 or 24 LTS recommended)
- **npm** 10+ (or pnpm / yarn / bun, but `package.json` is npm-flavoured)
- **Git**
- A [Supabase](https://supabase.com) project for the current Auth and sync code.
- A custom database and authentication backend only if you plan to replace the
  Supabase client integration in the application.

For deployment you can use:

- [Vercel](https://vercel.com) (zero-config, the default target)
- Any Node.js host that can run `next build && next start`
- A self-managed Linux VM with `pm2`, `systemd` or Docker
- A container platform that supports Next.js standalone output

---

## 2. Clone & install

```bash
git clone https://github.com/itsmarianmc/healthsync.git
cd healthsync
npm install
```

---

## 3. Environment variables

Create a `.env.local` file in the project root (or use the tracked
`.env.example` as a template). **Never commit actual credentials.**

```env
# Required - Supabase project URL and publishable / anon key.
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY

```

The full current variable list and the server-only account-delete key are
documented in [`.env.example`](.env.example).

Both Supabase values can be found in your Supabase project at
**Settings → API**. Use the *publishable* (anon) key - the `service_role`
key must **never** be exposed to the browser.

---

## 4. Option A - Supabase (recommended)

### 4.1. Create the project

1. Sign in to [Supabase](https://supabase.com) and create a new project.
2. Pick a region close to your users.
3. Wait for provisioning, then open the project dashboard.

### 4.2. SQL schema & RLS policies

For a new or isolated project, prefer the ordered CLI migrations under
`supabase/migrations/`; the production/test commands are in
`docs/security-migration.md`. The SQL block below remains a manual reference
for creating the base schema. The security migration installs owner-scoped,
MFA-aware policies, table and column grants, and the data reset function. For
an existing project, follow
`docs/security-migration.md` and inspect its actual schema and existing access
rules first.

```sql
-- =========================================================
-- HealthSync - Supabase schema (PostgreSQL)
-- Run this once in the SQL editor.
-- =========================================================

-- Extensions used for UUIDs.
create extension if not exists "pgcrypto";

-- ---------- Food entries (CalSync) ----------
create table if not exists calsync_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    text not null,
  food        text not null,
  brand       text,
  kcal        numeric not null default 0,
  amount      numeric,
  unit        text,
  prot        numeric not null default 0,
  carb        numeric not null default 0,
  fat         numeric not null default 0,
  barcode     text,
  is_drink    boolean not null default false,
  ts          bigint  not null,
  date        text    not null,
  created_at  timestamptz not null default now(),
  unique (user_id, entry_id)
);

create index if not exists calsync_entries_user_ts_idx
  on calsync_entries (user_id, ts desc);

alter table calsync_entries enable row level security;


-- ---------- Drink entries (DropSync) ----------
create table if not exists dropsync_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    text not null,
  drink       text not null,
  emoji       text,
  color       text,
  amount      integer not null default 0,
  ts          bigint  not null,
  date        text    not null,
  source      text,
  created_at  timestamptz not null default now(),
  unique (user_id, entry_id)
);

create index if not exists dropsync_entries_user_ts_idx
  on dropsync_entries (user_id, ts desc);

alter table dropsync_entries enable row level security;


-- ---------- User settings (goals + workout routines) ----------
create table if not exists user_settings (
  user_id          uuid primary key references auth.users on delete cascade,
  calorie_goal     integer not null default 2000,
  protein_goal     integer not null default 0,
  carbs_goal       integer not null default 0,
  fat_goal         integer not null default 0,
  goal_ml          integer not null default 2500,
  workout_routines jsonb,
  updated_at       timestamptz not null default now()
);

alter table user_settings enable row level security;


-- ---------- Workout sessions ----------
create table if not exists workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  session_id       text not null,
  routine_id       text,
  routine_name     text,
  start_time       timestamptz not null,
  end_time         timestamptz,
  duration_seconds integer not null default 0,
  exercises        jsonb,
  created_at       timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists workout_sessions_user_start_idx
  on workout_sessions (user_id, start_time desc);

alter table workout_sessions enable row level security;


-- ---------- Profile (only the owner can read/write after migration) ----------
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  full_name    text,
  avatar_url   text,
  latest_version text
);
alter table profiles enable row level security;

-- ---------- Auto-update updated_at on user_settings ----------
create or replace function tg_user_settings_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_settings_set_updated_at on user_settings;
create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function tg_user_settings_set_updated_at();
```

> **About the conflict targets:** `sync.ts` uses
> `onConflict: 'user_id,entry_id'` for food/drink entries and
> `onConflict: 'user_id'` for `user_settings`. The composite `unique`
> constraints above match those expectations.

### 4.3. Auth configuration

In the Supabase dashboard under **Authentication → URL Configuration**:

- **Site URL:** your primary deployment origin (e.g. `https://healthsync.example.com` or `http://localhost:3000` for local dev).
- **Redirect URLs:** add every origin you want to allow auth callbacks for, with `/**` at the end (e.g. `http://localhost:3000/**`, `https://healthsync.example.com/**`).

Email confirmation can be enabled under **Authentication → Providers → Email**.

### 4.4. MFA / TOTP

HealthSync's login flow supports TOTP via Supabase Auth. Enable it under
**Authentication → Multi-factor authentication** in the Supabase dashboard.
The app handles sign-in verification in `src/app/login/page.tsx` and factor
enrolment, testing and removal on `src/app/account/page.tsx`. A
verified factor requires a code before access. The app checks assurance during
session restore and in protected API routes; the database migration also
enforces it for table access. Apply the migration before deploying this code.
No trusted-device list is stored in the browser.

The app uses `public.profiles` for the signed-in user's `display_name`,
`full_name`, `avatar_url`, and `latest_version` (the last changelog version
acknowledged), plus account-level newsletter consent. Its primary key is `id`, linked to
`auth.users(id)` with `ON DELETE CASCADE`. The migration restricts profile
reads and writes to the owner and grants access only to these fields. The
additive `20261001010000_profile_latest_version.sql` migration grants the
changelog field separately. It does not expose profiles as a directory.

The additive migration
[`20261002010000_profile_newsletter_preferences.sql`](supabase/migrations/20261002010000_profile_newsletter_preferences.sql)
adds `newsletter_opt_in boolean not null default false`,
`newsletter_opt_in_at timestamptz` and `newsletter_opt_out_at timestamptz`.
It preserves existing profile rows and RLS policies, grants authenticated
owners SELECT on the preference and timestamps and UPDATE only on the
preference, and records the latest consent transition using a database trigger.
Apply this migration before deploying the `/account` newsletter preference UI.
No mail provider is configured and no newsletter messages are sent by this
feature.

---

## 5. Porting outline - SQLite (not supported by this repository as-is)

HealthSync's current client code assumes the Supabase JavaScript SDK. This
section is a design starting point only. To run **without** Supabase you must
implement and maintain a backend that mimics
the relevant calls (auth + the few `from(...).select/insert/upsert/delete`
operations in [`src/app/_lib/sync.ts`](src/app/_lib/sync.ts)). The schema
below maps the same tables to SQLite so you can use it with, for example,
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) behind a small
Express / Fastify / Hono API.

> SQLite has no built-in row-level security. The equivalent is **always**
> filtering every query by the authenticated `user_id` in your backend code,
> and never trusting `user_id` values sent from the client.
```sql
-- =========================================================
-- HealthSync - SQLite schema (DIY backend)
-- Tested with SQLite 3.38+. Save as schema.sql and run:
--     sqlite3 healthsync.db < schema.sql
-- =========================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------- Users (auth) ----------
-- Replace with your own auth implementation if you already have one.
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                       -- UUID v4
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,                          -- argon2id / bcrypt
  display_name    TEXT,
  totp_secret     TEXT,                                   -- nullable, encrypt at rest
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,                           -- random 256-bit
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  full_name    TEXT,
  avatar_url   TEXT
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- ---------- Food entries (CalSync) ----------
CREATE TABLE IF NOT EXISTS calsync_entries (
  id          TEXT PRIMARY KEY,                           -- UUID v4
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id    TEXT NOT NULL,                              -- client-generated
  food        TEXT NOT NULL,
  brand       TEXT,
  kcal        REAL NOT NULL DEFAULT 0,
  amount      REAL,
  unit        TEXT,
  prot        REAL NOT NULL DEFAULT 0,
  carb        REAL NOT NULL DEFAULT 0,
  fat         REAL NOT NULL DEFAULT 0,
  barcode     TEXT,
  is_drink    INTEGER NOT NULL DEFAULT 0,                 -- 0 = false, 1 = true
  ts          INTEGER NOT NULL,                           -- Unix ms
  date        TEXT NOT NULL,                              -- new Date().toDateString()
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, entry_id)
);

CREATE INDEX IF NOT EXISTS calsync_entries_user_ts_idx
  ON calsync_entries (user_id, ts DESC);

-- ---------- Drink entries (DropSync) ----------
CREATE TABLE IF NOT EXISTS dropsync_entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id    TEXT NOT NULL,
  drink       TEXT NOT NULL,
  emoji       TEXT,
  color       TEXT,
  amount      INTEGER NOT NULL DEFAULT 0,                 -- ml
  ts          INTEGER NOT NULL,
  date        TEXT NOT NULL,
  source      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, entry_id)
);

CREATE INDEX IF NOT EXISTS dropsync_entries_user_ts_idx
  ON dropsync_entries (user_id, ts DESC);

-- ---------- User settings ----------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  calorie_goal      INTEGER NOT NULL DEFAULT 2000,
  protein_goal      INTEGER NOT NULL DEFAULT 0,
  carbs_goal        INTEGER NOT NULL DEFAULT 0,
  fat_goal          INTEGER NOT NULL DEFAULT 0,
  goal_ml           INTEGER NOT NULL DEFAULT 2500,
  workout_routines  TEXT,                                 -- JSON serialised string
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mimic Postgres' auto-touch trigger.
CREATE TRIGGER IF NOT EXISTS user_settings_set_updated_at
AFTER UPDATE ON user_settings
FOR EACH ROW
BEGIN
  UPDATE user_settings
     SET updated_at = datetime('now')
   WHERE user_id = NEW.user_id;
END;

-- ---------- Workout sessions ----------
CREATE TABLE IF NOT EXISTS workout_sessions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id        TEXT NOT NULL,                        -- client-generated
  routine_id        TEXT,
  routine_name      TEXT,
  start_time        TEXT NOT NULL,                        -- ISO 8601
  end_time          TEXT,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  exercises         TEXT,                                 -- JSON serialised string
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS workout_sessions_user_start_idx
  ON workout_sessions (user_id, start_time DESC);
```

To wire this in, replace `src/app/_lib/supabase.ts` and `src/app/_lib/sync.ts`
with a client that hits your own HTTP API. The shapes you need to expose are:

- `POST /auth/sign-in`, `/auth/sign-up`, `/auth/sign-out`, `/auth/session`
- `GET /me/settings`, `PUT /me/settings`
- `GET/POST/DELETE /me/food` (maps to `calsync_entries`)
- `GET/POST/DELETE /me/drinks` (maps to `dropsync_entries`)
- `GET/POST /me/workouts` (maps to `workout_sessions` + `user_settings.workout_routines`)

Maintain the same field names so the rest of the app keeps working.

---

## 6. Optional: AI Detection (Google Gemini)

HealthSync ships an opt-in AI feature inside CalSync that estimates nutrition
values from a photo / camera capture / text description. There is **nothing**
to configure on the server side - the request is made **directly from the
user's browser** to `generativelanguage.googleapis.com` using **their own**
Gemini API key.

To enable AI Detection in a self-hosted instance:

1. Make sure the in-app cookie banner can grant third-party consent. The
   default `CookieBanner` already supports this.
2. Sign into HealthSync, open **Settings → AI Detection**, accept the in-app
   terms and paste a Google Gemini API key (get one at
   <https://ai.google.dev>).
3. Read the [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines)
   for usage limits and risks.

If you are deploying HealthSync for other people, make sure your own privacy
notice reflects that AI Detection is opt-in and uses the user's own key.

---

#### Development (added as §7) - `npm run dev`, `npx playwright test` etc

```bash
npm run dev          # next dev (Turbopack)
npm run lint         # ESLint with the Next.js config
npx playwright test  # E2E tests in e2e/
```

The dev server defaults to <http://localhost:3000>. The app is mobile-first -
use Chrome DevTools' device toolbar for a realistic preview.

---

## 8. Production build &amp; deployment

### Vercel (default)

1. Push the repository to GitHub.
2. **Do not commit `.env.local`.**
3. Import the repo into Vercel.
4. Set the environment variables from §3 in **Project Settings → Environment Variables** (production + preview).
5. Deploy.
6. In Supabase, add the deployed origin (e.g. `https://your-app.vercel.app/**`)
   to **Site URL** and **Redirect URLs**.

### Self-managed Node host

```bash
npm ci
npm run build
NODE_ENV=production npm run start
```

`next start` listens on port `3000` by default (override with `PORT=...`).
Put a reverse proxy (Caddy, nginx, Traefik) in front of it that terminates
TLS, sets `X-Forwarded-*` headers and serves on 443.

### Docker (example)

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build & run:

```bash
docker build -t healthsync .
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  healthsync
```

---

## 9. Updating &amp; migrations

Pull the latest code, reinstall dependencies and run any newly added SQL
fragments. The schema in §4.2 / §5 is idempotent (`if not exists`), so you
can re-run it safely; **review** any net-new columns or constraints before
applying them to a production database.

```bash
git pull
npm ci
npm run build
```

---

## 11. Backups & data export

### Supabase

Use the built-in **Backups** feature (paid plans) or schedule
`pg_dump` against the connection string from **Settings → Database**:

```bash
pg_dump --no-owner --no-acl \
  "postgresql://USER:PASSWORD@HOST:5432/postgres" \
  > healthsync-$(date +%F).sql
```

### SQLite

```bash
sqlite3 healthsync.db ".backup healthsync-$(date +%F).db"
```

### Per-user export

HealthSync stores user data locally in `localStorage`. Users can clear it
from **Settings → Cookies / Browser settings → Clear site data**. A full
export endpoint is not part of the default app - add one in your fork if
your jurisdiction requires Art. 20 GDPR (data portability) self-service.

---

## 12. Hardening checklist

- [ ] `.env.local` is in `.gitignore` and never committed.
- [ ] You use the **publishable / anon** Supabase key in the client, **never** the `service_role` key.
- [ ] All five app tables have RLS **enabled** and owner-scoped policies; accounts with a verified MFA factor require `aal2` (see §4.2 and `docs/security-migration.md`).
- [ ] Supabase **Site URL** and **Redirect URLs** include only the origins you control.
- [ ] HTTPS is terminated in front of HealthSync; HTTP requests are redirected to HTTPS.
- [ ] Email confirmations and a sensible password policy are enabled in Supabase Auth.
- [ ] MFA / TOTP is enabled for accounts that hold real health data.
<!-- /api/proxy route was removed in favor of direct Gemini API calls. -->
- [ ] Your hosting provider's privacy policy, your cookie banner config and the in-app legal pages reflect your real setup.

---

## 13. Troubleshooting

**"Invalid API key" or 401s from Supabase**
Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
and make sure they are set in *both* the build environment (Vercel /
Docker / shell) and your local `.env.local`. Restart `next dev` after
changing them.

**"new row violates row-level security policy"**
A `user_id` mismatch. Make sure you are signed in (`auth.uid()` must be
non-null) and that the policy in §4.2 was actually applied. Re-run the SQL
script - it is idempotent.

**Login works but data does not sync**
Open the browser console. `sync.ts` logs every backend error prefixed with
`[sync]`. Most of the time it is a missing table, missing unique constraint
or a stale RLS policy.

**MFA QR code does not render**
The QR code for TOTP setup is rendered on `/account` with the local
`qrcode.react` dependency. It does not use a QR-code CDN.

**AI Detection does nothing**
The feature is disabled by default. Enable it in *Settings → AI Detection*,
accept the in-app AI terms, grant third-party cookie consent and paste a
valid Gemini API key. See the [AI Guidelines](https://healthsync.itsmarian.dev/legal/ai-guidelines).

---

If something is missing or unclear, please open an issue at
<https://github.com/itsmarianmc/healthsync/issues>.
