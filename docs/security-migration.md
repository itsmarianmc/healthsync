# Supabase schema and security runbook

## What this checkout establishes

The current repository contains only
[`20261002010000_profile_newsletter_preferences.sql`](../supabase/migrations/20261002010000_profile_newsletter_preferences.sql).
It alters an already existing `public.profiles` table to add newsletter
preference and timestamp columns, installs a timestamp trigger, and grants
authenticated column-level SELECT and UPDATE access. It does **not** create
`profiles`, the health-data tables, base grants or RLS policies, MFA helpers,
the `clear_healthsync_data()` RPC, or the foreign keys required for account
deletion. The SQL setup section in [`hosting.md`](../hosting.md) is a reference
schema, not an executable migration history or proof of the current remote
schema.

Older audit notes record maintainer reports about migrations and database tests
performed against other checkouts/projects. Those files, database query output,
and project state are not available for independent verification from this
working tree. The reports are retained as historical context in
[`quality-audit.md`](./quality-audit.md); do not use them as evidence that a
current DEV or production database has the expected schema or policies.

Before applying even the available additive migration, inspect the target
database and its Supabase migration history. Confirm that `public.profiles`
exists, that its owner/MFA policies are already correct, and that the pending
migration is intended for that project. The newsletter migration does not
replace or repair any existing policy. Applying it does not configure an email
provider or send email.

## Read-only preflight

Run these queries in the intended Supabase project and retain their output with
the change record. They inspect the actual target; repository SQL alone cannot
confirm deployed state.

```sql
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'calsync_entries', 'dropsync_entries', 'workout_sessions', 'user_settings')
order by table_name, ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'calsync_entries', 'dropsync_entries', 'workout_sessions', 'user_settings')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'calsync_entries', 'dropsync_entries', 'workout_sessions', 'user_settings')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('profiles', 'calsync_entries', 'dropsync_entries', 'workout_sessions', 'user_settings')
order by table_name, column_name, grantee, privilege_type;

select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'calsync_entries', 'dropsync_entries', 'workout_sessions', 'user_settings')
  and not t.tgisinternal;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.profiles'::regclass, 'public.calsync_entries'::regclass,
  'public.dropsync_entries'::regclass, 'public.workout_sessions'::regclass,
  'public.user_settings'::regclass
);
```

The final query assumes all five tables exist; if any are absent, first use the
column query to identify that and adapt the constraint inspection. Also inspect
views, `SECURITY DEFINER` functions, role memberships, default privileges,
Auth hooks and foreign keys that reference these tables. In particular, account
deletion in the app relies on `ON DELETE CASCADE` from `auth.users` for profile
and health rows. A repository declaration or client-side check is not a
substitute for target-database evidence.

## Expected application contract

The client expects these tables and conflict keys:

| Table | Expected role | Client key / behavior |
|---|---|---|
| `profiles` | Account display fields, changelog acknowledgement and newsletter preference | `id = auth.users.id`; client selects the signed-in user's row |
| `calsync_entries` | Food entries and deletion state | `(user_id, entry_id)` |
| `dropsync_entries` | Drink entries and deletion state | `(user_id, entry_id)` |
| `user_settings` | Goals, supplement/activity settings, routines and reset marker | `user_id` |
| `workout_sessions` | Completed workout history | `(user_id, session_id)` |

The exact base columns, constraints, RLS policies, grants and reset RPC must be
confirmed against the target. The reference table definitions are in
[`hosting.md`](../hosting.md); sync mappings and local formats are in
[`data-model-and-storage.md`](./data-model-and-storage.md).

The checked-in newsletter migration adds `newsletter_opt_in boolean not null
default false`, `newsletter_opt_in_at timestamptz`, and
`newsletter_opt_out_at timestamptz`. Its trigger records the time of a change
to the opt-in boolean. Authenticated users receive SELECT on those three
columns and UPDATE on `newsletter_opt_in`; the migration does not grant table
access or modify RLS. Confirm the resulting effective permissions and policies
on the intended target after applying it.

## Authorization checks to perform in an isolated project

Use disposable accounts and the publishable/anon key with their real user JWTs.
Never put a service-role key in a browser or use it to test RLS. Test direct
database access as well as the app/API flow, and record project, account
factor status, JWT assurance level, action, expected result, and observed
result.

| State | Expected result to verify |
|---|---|
| Guest / `anon` | No profile or health data access; local tracking remains usable |
| Account without a verified TOTP factor at AAL1 | Access only to its own permitted profile and health data |
| Account with a verified factor at AAL1 | Protected reads and writes are denied until the MFA challenge completes |
| Same verified-factor account at AAL2 | Access only to its own permitted profile and health data |
| Two accounts | Neither can read or change the other's profile or health rows |
| Sync retry | Failed cloud reads/writes do not discard pending local records or appear as successful empty sync |
| Delete All Data | Reset RPC removes/reset expected health data and preserves intended profile identity fields |
| Account deletion | Auth user and dependent rows are removed through verified database cascades |

Test SELECT, INSERT, UPDATE and DELETE for each applicable table, plus both
denied and allowed calls to `clear_healthsync_data()`. Also verify unique
conflict keys, deletion markers, settings defaults and reload behavior. A
successful SQL transaction or a passing browser suite alone does not establish
all of these properties.

## Historical reports and current verification boundary

The prior audit log includes maintainer-provided reports of an isolated-clone
migration, owner/AAL read checks, SQL writes/reset, application tests and a
production build. It also records an earlier production profile-column
discrepancy and later reported history repair. These are dated reports, not
independent evidence for the current checkout or target database. No database
was queried or changed as part of the October 2, 2026 documentation audit.

No current production migration/deployment status is established here. Do not
describe the security rollout as complete until the exact checked-in migration
set, target history/schema, owner/MFA matrix, reset/deletion behavior, and
matching deployed application have current, reviewable evidence.
