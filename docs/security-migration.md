# Security and synchronization migration (2026-09-30)

This migration is **not applied automatically by the application**. The
maintainer reports that all four local migrations match the remote migration
history and supplied a read-only production SQL check of the current policies
and owner/AAL visibility on all five app tables. Direct INSERT/UPDATE/DELETE
and an allowed reset were not exercised in that check. In a separate
2026-10-02 follow-up, the maintainer reports that the SQL write cases and an
allowed `clear_healthsync_data()` reset passed; the exact operation matrix was
not supplied, and this report was not independently repeated here. The
maintainer also reports that the current E2E suite and production build pass;
the exact E2E count was not supplied. The application code requires its
`deleted_at`, `data_reset_at`, and `intensity` columns, policies, grants, and
RPC function. Deploy the migration before the matching application release.
Do not use a production service-role key in tests.

The maintainer also reports passing application tests after an onboarding
profile-insert/RLS issue was resolved. The six follow-up acceptance cases below
require explicit evidence for any remaining uncovered owner/MFA or deployment paths.

An earlier 2026-10-01 RLS test returned PostgreSQL `42703` because
`public.profiles.latest_version` was absent. The maintainer subsequently
applied the additive profile migration and reconciled the remote migration
ledger; the later read-only SQL check covered owner/MFA SELECT behavior. Keep
the earlier error as rollout history, not as the current schema status.

The earlier schema query showed the existing
`profiles.last_seen_changelog_version` text column but no `latest_version`.
The additive migration copies old per-account values into `latest_version`
only where the new field is null and grants access to the new field. It leaves
the old column in place. The later maintainer-supplied checks recorded the
column/grants, backfill, migration history, and authenticated owner/AAL reads.
The maintainer separately reports successful SQL writes and an allowed reset
on 2026-10-02; see the qualification at the top of this runbook.

## Inspect the actual database first

Save the output and compare it with the expected schema. The repository cannot
inspect the production database, so the policies supplied in the audit are
evidence, not a complete catalog.

```sql
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name in
  ('profiles','calsync_entries','dropsync_entries','workout_sessions','user_settings')
order by table_name, ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename in
  ('profiles','calsync_entries','dropsync_entries','workout_sessions','user_settings')
order by tablename, policyname;

select grantor, grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in
  ('profiles','calsync_entries','dropsync_entries','workout_sessions','user_settings')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name in
  ('profiles','calsync_entries','dropsync_entries','workout_sessions','user_settings')
order by table_name, column_name, grantee;

select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('profiles','calsync_entries','dropsync_entries','workout_sessions','user_settings')
  and not t.tgisinternal;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in
  ('public.profiles'::regclass,'public.calsync_entries'::regclass,
   'public.dropsync_entries'::regclass,'public.workout_sessions'::regclass,
   'public.user_settings'::regclass);

select conrelid::regclass as referencing_table,
       confrelid::regclass as referenced_table,
       conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype='f'
  and confrelid in
    ('auth.users'::regclass,'public.profiles'::regclass,
     'public.calsync_entries'::regclass,'public.dropsync_entries'::regclass,
     'public.workout_sessions'::regclass,'public.user_settings'::regclass)
order by referenced_table, referencing_table, conname;

select 'food' as kind, user_id, entry_id, count(*) from public.calsync_entries
group by 1,2,3 having count(*)>1
union all
select 'drink', user_id, entry_id, count(*) from public.dropsync_entries
group by 1,2,3 having count(*)>1;
```

Also inspect views and `SECURITY DEFINER` functions that reference these tables,
role memberships, default privileges, and Auth hooks. An extra policy or grant
can change the effective access. A view owned by a privileged role can bypass
table RLS. Resolve unexpected results before applying. Check that profile and
health-table foreign keys to `auth.users` use `ON DELETE CASCADE`; account
deletion now relies on these constraints and fails visibly if they do not.
Review every inbound foreign key in the query above: custom tables that
reference these rows can also block deletion or require an intentional cascade.
The migration stops before changing policies unless `profiles.id` and
`user_settings.user_id` already have single-column unique indexes, as required
by the app's upserts.

The security migration replaces **all** policies on the five app tables. Review each
existing policy and any dependent integration before approving that step. Its
column-grant reset covers `PUBLIC`, `anon`, and `authenticated`; inspect grants
through other roles separately. `profiles` is intentionally owner-readable
only. The app needs `id`, `display_name`, `full_name`, and `avatar_url`. A public
profile directory or privileged profile field requires a separate design.
An UPDATE policy without `WITH CHECK` was not by itself a flaw: PostgreSQL uses
the `USING` expression for the new row if no explicit check is provided.

## CLI migrations and rollout order

The repository contains a baseline schema migration, the owner/MFA sync
migration, the reset-defaults follow-up, and an additive profile changelog-version
migration. They are timestamped and applied in that order by the Supabase CLI.
`supabase db push` applies schema migrations only; it does not copy Auth users,
health rows, Storage objects, secrets, Auth
settings or project configuration. Restore database data and configure Auth
separately when preparing a clone.

For the current production project reference shared by the maintainer, the
PowerShell deployment sequence is:

```powershell
npx supabase login
npx supabase link --project-ref stuqtqlkantewwxhwitg
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review the target and all pending migration versions before proceeding.
npx supabase db push --linked
```

The CLI may ask for the database password while linking. `link` changes only the
local CLI target. The dry run previews pending migration versions; the final
command is the operation that changes the linked remote database. If the
production project reference has changed, replace the reference in `link` and
confirm it again before pushing. The original SQL-editor application was not
recorded in CLI migration history, so the first push may execute the baseline,
security and hotfix migrations again. The baseline uses `IF NOT EXISTS`; the security
migration deliberately replaces all policies on its five target tables, so
complete the database preflight and backup before that first push. Do not use
`migration repair` to mark these files applied unless the actual database has
been checked against every migration and the history mismatch is understood.

## Order

1. Take a verified backup and a schema-only dump of these five tables,
   policies, grants, functions, and triggers. Save the preflight output.
2. Restore a backup only when a data clone is required. In a fresh isolated
   project, link the CLI to that project and run `npx supabase db push
   --linked --dry-run`, inspect the pending list, then `npx supabase db push
   --linked`. Resolve duplicate `(user_id, entry_id)` or `(user_id,
   session_id)` rows deliberately before unique indexes are created. The prior
   clone run is complete; do not treat successful SQL as proof that all app
   flows work.
3. In that project, exercise the matrix below with test users and a verified
   TOTP factor. Confirm no unexpected policies, triggers, grants, or views
   permit access. The migration is one transaction and rolls back on error.
4. Repeat the preflight against the intended target and compare it with the
   tested copy. Push the pending migrations, then deploy the matching app code. The
   repository and the test-clone result do not confirm a production database
   change or deployment.

## Follow-up fix: Delete All Data settings defaults

On 2026-10-01, the maintainer reported that Delete All Data on the cloned DEV
project first returned PostgreSQL error `23502` because
`user_settings.supplements_taken` was `NOT NULL`; after that field was fixed,
the next retry showed the same constraint on `user_settings.status`. The reset
function now writes an empty JSON object for `supplements_taken` and the app's
default activity status (`active` / `until_changed`) for `status`. For projects
where the original migration has already been applied, run the updated
additive [`20261001000000_fix_data_reset_defaults.sql`](../supabase/migrations/20261001000000_fix_data_reset_defaults.sql)
in that project's SQL Editor, then retry Delete All Data with a disposable
test account. Do this on the isolated DEV clone first. Do not consider deletion
verified until both the RPC succeeds and the health rows/settings have the
expected reset state. This fix has not been applied to production based on
repository evidence.

The maintainer also reported an unfinished TOTP enrollment that failed because
a factor with an empty friendly name already existed. The login page now checks
factor-list and cleanup errors, removes unverified interrupted enrollments
before starting another, gives new factors a friendly name, and renders the
Supabase-provided QR URI locally. Supabase sets `nextLevel` to `aal2` while an
enrollment is unverified, so the app now requires both a verified factor and a
session below `aal2` before it blocks access. Leaving setup through the page's
Back actions removes its unverified factor; setup is only labeled active after
verification. A pending factor left by closing the browser is not treated as
enabled and is cleaned up when setup is started again. Test sign-in, sync and
cancellation after scanning but before confirming on DEV before production
rollout; code changes alone are not evidence of successful enrollment.

## Required isolation tests

Use the Supabase client with the publishable key and real isolated test JWTs;
never use the service-role key for these tests. Assert both direct table access
and the app's sync and delete endpoints.

| State | Expected result |
| --- | --- |
| Guest (`anon`) | No rows or RPC access; local tracking works |
| User A without a verified factor, `aal1` | Own rows and reset RPC work |
| User B with a verified factor, `aal1` | No SELECT, INSERT, UPDATE, DELETE, profile upsert, or reset RPC |
| User B after TOTP verification, `aal2` | Own rows and reset RPC work |
| User A vs user B | Neither account can read or alter the other's rows or profile |
| Two browsers, one offline | Repeated drink/workout upload is idempotent; a tombstoned food/drink stays hidden |
| Failed cloud write | Local queue remains; reconnect retries; no success toast for a failed cloud operation |
| Account switch | Each browser workspace remains separate; guest import requires explicit action |
| Delete All Data | Cloud rows gone, settings reset, other device discards old queue via `data_reset_at` |

Also capture these explicit end-to-end acceptance results before declaring the
security/sync validation complete:

| Acceptance case | Evidence to record |
|---|---|
| Guest mode | Can create and reload local health entries without an account; no guest cloud rows |
| No verified MFA | Own profile and health data can be read and changed at the expected assurance level |
| Account isolation | Two disposable accounts cannot select or mutate each other's profiles or health rows |
| Verified MFA | Protected access is denied before TOTP completion and works for the owner's data afterward |
| Reload sync | Food, drinks and completed workouts still appear after cloud sync and reload |
| Destructive actions | Delete All Data clears health data; account deletion removes the disposable Auth user and cascaded rows |

The maintainer requested these six checks as Notion tasks. The status below
records the maintainer's reports as reports; it is not independent verification.
Update the evidence/status when the remaining DEV checks are completed.

| Acceptance case | Current status reported by maintainer |
|---|---|
| Guest mode | Pass: local data remains usable. |
| No verified MFA | Pass: own profile and health data can be read and changed per maintainer; direct A-at-AAL1 SQL test allowed own profile read/update. |
| Account isolation | Direct SQL reads across all five tables showed only each account's own baseline rows at its permitted AAL; prior no-op UPDATE checks denied foreign profile and one foreign food row. Full cross-account CRUD remains untested. |
| Verified MFA | B at AAL1 saw no rows on all five tables and the reset RPC returned `42501`; B at AAL2 saw all own baseline rows. A without a verified factor saw own rows at AAL1. Positive health-table writes and reset RPC success are separate app-level reports, not part of this read-only SQL run. |
| Reload sync | Pass: food, drinks and workouts remain after reload. |
| Destructive actions | Pass per maintainer: Delete All Data works after the reset-RPC hotfix, and account deletion works with a disposable account. |

For the MFA assertions, verify the Auth JWT `aal` claim and the factor's
`verified` status. Test a restored `aal1` session by opening a protected URL
directly. Test `/api/account/delete` only with disposable test users.

### Manually applied profile-version migration (2026-10-01)

The maintainer reports applying
[`20261001010000_profile_latest_version.sql`](../supabase/migrations/20261001010000_profile_latest_version.sql)
in the production project's SQL Editor. Follow-up checks found the new column,
authenticated SELECT/INSERT/UPDATE column privileges, no anonymous SELECT
privilege, and seven legacy version values copied to `latest_version`.
The first supplied `supabase_migrations.schema_migrations` result contained only
versions `20260929000000`, `20260930000000`, and `20261001000000`: the manual
migration was absent from the ledger. The maintainer subsequently ran Supabase
CLI `migration repair 20261001010000 --status applied --linked` against the
linked project reference `stuqtqlkantewwxhwitg`. The CLI reported success, and
both `migration list --linked` and a SQL history query showed all four versions
present, with `20261001010000` named `profile_latest_version` in SQL. The
migration history is aligned for that queried project; the CLI repair recorded
history and did not rerun migration SQL.

### Read-only production RLS matrix supplied by maintainer (2026-10-01)

The maintainer supplied a single SQL Editor result after simulating the `anon`
role and two authenticated identities. The `postgres` baseline had A/B row
counts of profiles 1/1, settings 1/1, food 3/66, drinks 1/18, and workout
sessions 0/7. At AAL2, B saw exactly B's rows in all five tables and no
foreign rows. At AAL1, B saw zero rows in all five, `healthsync_mfa_ok()` was
false, and `clear_healthsync_data()` returned SQLSTATE `42501`. At AAL1, A had
`healthsync_mfa_ok()` true and saw only A's baseline rows. Anonymous reads on
all five tables and the reset RPC returned `42501`. RLS, listed policies,
table grants, and RPC execution grants matched the migration's intended
structure; profile access uses column grants rather than table-wide grants.

This transaction was read-only. It confirms the stated SELECT isolation and
denied reset behavior, while direct INSERT/UPDATE/DELETE checks on every
health table and an allowed reset call remain outside this SQL result. Use
disposable accounts for any further write/reset acceptance tests.

## Conflict and deletion rule

Each browser stores a separate active workspace for guest and each user ID.
Old unscoped data is treated as guest data. The Settings action explicitly
imports guest food, drinks, and workouts into one account and consumes the
guest copy. Cloud rows are authoritative for an account except locally marked
pending writes. Individual food and drink deletion sets `deleted_at`; later
uploads that omit this field cannot clear the tombstone. Undo explicitly clears
it. This retains the deleted row until Delete All Data or account deletion;
review retention needs for your privacy policy. Delete All Data physically
removes health rows and resets app settings. It preserves account identity
fields in `profiles`; account deletion removes that row through its
`ON DELETE CASCADE` foreign key. Other devices compare `data_reset_at` before
uploading queued entries.

## Backout

If the SQL transaction fails, PostgreSQL rolls it back. After commit, stop the
matching app release and restore the saved schema and data backup to an
isolated project first. Compare its grants, policies, triggers, and row counts,
then restore to the target in a maintenance window. A generic `DROP POLICY`
rollback is unsafe because existing policies and column grants may differ
from the audit snapshot. Do not reopen the old `profiles USING (true)` policy
or the `auth.uid()`-only policies as a quick workaround.
