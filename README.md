# HealthSync

A mobile-first Progressive Web App for personal health tracking. HealthSync combines calorie counting, hydration tracking, and workout logging in a single, unified interface - designed to feel like a native app in the browser.

Live at [healthsync.itsmarian.dev](https://healthsync.itsmarian.dev)

---

## Features

**Dashboard**
A daily overview with a weighted health score, calorie and water progress bars, macro tracking, a 7-day bar chart, recent activity feed, and a rule-based next-step suggestion. Everything reads from local storage - no loading states, no spinners.

**CalSync - Food Tracking**
Log meals via free-text search, barcode scanning (ZXing / Open Food Facts), or manual entry. Macro rings show daily protein, carbs, and fat progress. Entries sync to the cloud when logged in.

**DropSync - Hydration Tracking**
A two-step bottom sheet: pick a drink, then set the amount by dragging a glass up or down. Snap points at common volumes (100 to 1000 ml). Swipe to close, pull up to expand. A history sheet shows all entries grouped by date.

**Settings**
Goals for calories, water, and macros. A built-in calorie calculator using the Mifflin-St-Jeor formula. Workout routines with a live session timer and per-set logging. AI tip toggle with optional Gemini API key.

**Auth**
Email and password login with optional TOTP two-factor authentication. Register, forgot password, and change password flows. "Remember this device" skips the 2FA step on trusted devices.

**PWA**
Installable on mobile via the browser's add-to-home-screen prompt. Offline-capable for previously loaded data via local storage.

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS with CSS custom properties |
| Backend | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth with TOTP MFA |
| Font | DM Sans |
| Icons | Font Awesome 7 |
| Barcode | ZXing (`@zxing/browser`) |
| Deployment | Vercel |

---

## Self-Hosting

### Prerequisites

- Node.js 18 or later
- A Supabase project
- A Vercel account (or any Node.js-capable host)

### 1. Clone the repository

```bash
git clone https://github.com/itsmarian/healthsync.git
cd healthsync
npm install
```

### 2. Set up Supabase

In your Supabase project, open the SQL editor and run the following to create the required tables:

```sql
-- Create Food Entries Table
create table calsync_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  entry_id text unique not null,
  food text not null,
  brand text,
  kcal numeric not null default 0,
  amount numeric,
  unit text,
  prot numeric not null default 0,
  carb numeric not null default 0,
  fat numeric not null default 0,
  barcode text,
  is_drink boolean default false,
  ts bigint not null,
  date text not null,
  created_at timestamptz default now()
);

--- Add RLS To Table
alter table calsync_entries enable row level security;
create policy "Users access own food entries"
  on calsync_entries for all
  using (auth.uid() = user_id);

-- Create Drink Entries Table
create table dropsync_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  entry_id text unique not null,
  drink text not null,
  emoji text,
  color text,
  amount integer not null default 0,
  ts bigint not null,
  date text not null,
  created_at timestamptz default now(),
  source text
);

--- Add RLS To Table
alter table dropsync_entries enable row level security;
create policy "Users access own drink entries"
  on dropsync_entries for all
  using (auth.uid() = user_id);

-- Create User Settings Table
create table user_settings (
  user_id uuid primary key references auth.users not null,
  calorie_goal integer default 2000,
  protein_goal integer default 0,
  carbs_goal integer default 0,
  fat_goal integer default 0,
  goal_ml integer default 2500,
  workout_routines jsonb,
  updated_at timestamptz default now()
);

--- Add RLS To Table
alter table user_settings enable row level security;
create policy "Users access own settings"
  on user_settings for all
  using (auth.uid() = user_id);
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_abcdefghijklmnopqrstuvwxyzabcde
```

Both values can be found in your Supabase project under Settings > API Keys.

### 4. Configure Supabase Auth

In your Supabase dashboard under Authentication > URL Configuration, set:

- **Site URL**: Add the sites you need to have auth access for. Example, for local development, or your production domain
- **Redirect URLs**: Example, add your local development domain and your production domain with `/**`

### 6. Deploy/Host

Push the repository to GitHub or keep it local (when pushing to GitHub DO NOT PUSH YOUR ENVIRONMENT VARIABLES!), then import it into any third party provider.

Once deployed, update the Supabase Site URL and Redirect URLs to your production domain.

---

## Project Structure

```
app/
├── layout.tsx              # Root layout: AuthProvider, global CSS
├── page.tsx                # App shell: view switching, all modals
├── styles.css              # Global styles
├── login/
│   ├── layout.tsx          # Loads QRCode.js for 2FA setup
│   └── page.tsx            # Full login, register, MFA, reset flows
├── _lib/
│   ├── supabase.ts         # Supabase browser client
│   ├── types.ts            # TypeScript interfaces
│   └── sync.ts             # All Supabase CRUD functions
├── _context/
│   └── AuthContext.tsx     # Auth state, user, settings
├── _hooks/
│   ├── useDashboardData.ts # Dashboard calculations
│   ├── useDraggableSheet.ts # Shared sheet drag logic
│   └── useOnboarding.ts    # Onboarding state
└── _components/
    ├── shared/             # Toast, Tooltip, SplashScreen, PullToRefresh
    ├── navigation/         # BottomNav with animated slider
    ├── dashboard/          # ScoreRing, MetricGrid, MacroGrid, WeekChart, RecentList, NextWidget, AiTips
    ├── calsync/            # CalSync view, modal, food list, barcode scanner
    ├── dropsync/           # DropSync view, modal, drink picker, glass input, history
    ├── settings/           # Settings sheet, goals, account, AI section, workout
    ├── notes/              # Notes modal
    └── onboarding/         # Onboarding slides and tooltip tour
```

---

## Documentation

For a detailed breakdown of the app's functionality, component structure, database schema, localStorage keys, and implementation notes, see [FUNCTIONALITY.md](./FUNCTIONALITY.md).

---

## License

MIT


<h1></h1>
<p align="center">
    <span>&copy; 2026 HEALTHSYNC via <a href="https://github.com/itsmarianmc/">itsmarian</a> | All rights reserved.</span>
</p>