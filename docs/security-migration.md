# Supabase schema and security runbook

## What this checkout establishes

As inspected on October 26, 2026, the checkout initially had no
`supabase/migrations/` directory. Its only newly prepared migration is
[`20261026010000_custom_foods.sql`](../supabase/migrations/20261026010000_custom_foods.sql),
which adds `custom_foods jsonb NOT NULL DEFAULT '[]'::jsonb` to an existing
`public.user_settings` table. It does not change RLS, grants, triggers or the
`clear_healthsync_data()` RPC. It has not been applied here.

The Web Push, custom-supplements, baseline and historical owner/MFA/reset
migrations referenced in earlier notes are absent from this checkout. The SQL
setup section in [`hosting.md`](../hosting.md) is a reference schema, not proof
of a live database or complete migration history. No external database was
queried or changed for the custom-food library.

Before any deployment/migration, inspect the intended project's schema and
migration history. For an existing `custom_foods` column, verify type,
nullability and default: `ADD COLUMN IF NOT EXISTS` does not repair these.
Check owner/MFA access and effective column grants. Separately inspect how the
actual reset RPC clears this new settings field; its source is unavailable
here. Historical maintainer reports in [`quality-audit.md`](./quality-audit.md)
do not establish current target-project state.

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
| `user_settings` | Goals, supplement/activity settings, custom supplement/food definitions, routines and reset marker | `user_id` |
| `workout_sessions` | Completed workout history | `(user_id, session_id)` |

The exact base columns, constraints, RLS policies, grants and reset RPC must be
confirmed against the target. The reference table definitions are in
[`hosting.md`](../hosting.md); sync mappings and local formats are in
[`data-model-and-storage.md`](./data-model-and-storage.md).

The historical custom-supplements migration (absent here) adds
`custom_supplements jsonb not null default '[]'::jsonb` to the expected
`public.user_settings` table. It does not grant table or column access and does
not modify RLS. The profile newsletter migration described in older notes is
not present in this checkout. Confirm the target's effective permissions and
policies independently before applying any migration.

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

## Web Push – additive Migration vom 24.10.2026

Neu vorhanden ist ausschließlich [20261024010000_web_push.sql](../supabase/migrations/20261024010000_web_push.sql). Diese Datei wurde nicht angewendet. Sie erstellt zwei neue Tabellen mit Auth-Cascade und zwei eng begrenzte Definer-Funktionen mit festem search_path; vorhandene Policies bleiben erhalten. Vor Anwendung zusätzlich die Namen push_subscriptions, push_test_limits, push_access_allowed und claim_push_test auf Kollisionen und die Supabase-Auth-Struktur prüfen. Die Owner-/AAL1-/AAL2-/Parallelversand-Testmatrix und Details stehen unter [Web Push](./web-push.md). Ältere Nachweise zu fünf App-Tabellen sind kein Nachweis für diese neuen Tabellen.
