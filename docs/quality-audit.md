# Quality and security validation status

Status snapshot: 2026-10-01. This is a dated evidence record, not an ongoing CI
dashboard. Update it when a new run or database verification is completed.

## Checkout boundary observed 2026-10-02

This documentation audit read the current source/configuration and existing
working-tree changes but did not run unit tests, E2E, lint, TypeScript, or a
build, and did not query or change a Supabase project. Therefore it adds no
fresh pass/fail results. The current checkout contains only
`supabase/migrations/20261002010000_profile_newsletter_preferences.sql`; the
baseline, owner/MFA security, reset-defaults, and profile-version migration
files named in older entries below are absent. Those older migration and
database statements are historical, dated maintainer/audit reports, not
evidence for this checkout's migration chain or any current remote database.

The worktree already had changes before this documentation audit, including
application files, a new account route and this set of modified documents.
Those changes were treated as the source being documented. No application
file or external system was changed by the audit.

## Source and app checks

The earlier repository audit recorded the following results for the then-current
working tree:

- TypeScript `tsc --noEmit`: passed.
- `node --test tests/localData.test.mjs`: 10 tests passed.
- Next.js production build: passed (Next.js 16.2.9).
- ESLint on `localData.ts` and `syncPolicy.ts`: passed.
- `git diff --check`: passed at the time of that audit.
- Whole-repository ESLint: failed with 136 errors and 102 warnings in that
  recorded scan. These findings were not a clean lint pass.
- A Playwright run initially timed out in Edge before `domcontentloaded`.

After that recorded audit, the maintainer reported that an onboarding failure
was resolved and that the tests performed so far passed. This documentation
update did not rerun unit tests, Playwright, lint, TypeScript or the build, so
it does not establish the current result of a fresh run. The earlier Edge
timeout should not be treated as the current outcome after the reported fix.

## Fresh push-readiness audit (2026-10-01)

The current working tree was checked after the sync-toast, TOTP autofill and
update-version changes:

- Local TypeScript `tsc --noEmit`: passed.
- `node --test tests/localData.test.mjs`: 10 tests passed.
- `git diff --check`: passed; Git only reported line-ending normalization notices.
- Whole-repository ESLint via the local binary: failed with 135 errors and 92
  warnings across 116 files. `npm run lint` itself cannot start because the
  global npm launcher points to a missing `npm-cli.js`.
- Production build and Playwright/E2E were not run. The requested UI paths have
  no new automated browser coverage in this run.
- The new additive migration
  `20261001010000_profile_latest_version.sql` has not been applied or verified
  against a Supabase project. The update-center read/write behavior therefore
  still needs a database check after the migration is applied.
- The branch is `v4.0.0` and tracks `origin/v4.0.0`; the index is clean, with 57
  modified tracked paths and 13 untracked paths in the worktree. The complete
  worktree has not been staged or reviewed as one push unit.

**Push readiness: not ready.** Resolve the lint errors, review and stage the
intended worktree changes, apply and verify the pending Supabase migration using
the preflight in [`security-migration.md`](./security-migration.md), then run a
production build and the relevant browser flows before pushing.

## Supabase validation

The maintainer reports that `20260930000000_security_sync.sql` completed without
error on the cloned HealthSync development project. They also checked the
preflight outputs and corrected the profile insert/RLS issue encountered during
onboarding. This confirms a migration run on that clone, not on production.

The following broader acceptance cases were then created as Notion tasks:

1. Guest mode stays local and works.
2. An account without verified MFA can read and edit its own profile and health
   data.
3. Two accounts cannot read or edit each other's data.
4. A verified-MFA account is blocked before the second factor and allowed its
   own access after verification.
5. Food, drinks and workouts remain synchronized after reload.
6. Delete All Data and account deletion work with a disposable test account.

Do not mark a case complete merely because the SQL transaction succeeded or
the app's tests so far passed. Record the tested project, test accounts/state,
actions, expected result and observed result in
[`security-migration.md`](./security-migration.md) when each is actually
verified.

On 2026-10-01, the maintainer reported successful guest-mode, no-verified-MFA
own-data, and reload-persistence checks. Delete All Data then exposed
`NOT NULL` failures for `supplements_taken` and, on retry, `status` in the reset
RPC. The additive SQL hotfix and matching fresh-install migration correction
now reset both fields to valid defaults. The maintainer subsequently confirmed
that Delete All Data and disposable-account deletion both work. The maintainer
also reported an interrupted TOTP factor, no visible QR, and account-page navigation. The app
code now cleans up unverified enrollments with surfaced errors, renders the QR
locally, and keeps account management on `/login`; those changes still require
manual DEV verification. A follow-up review found that Supabase reports
`nextLevel: aal2` for an unverified factor, which the app had treated as active
MFA. The login, app-session and API gates now check verified factor status;
cancellation removes an unverified factor. This correction also requires DEV
verification. Cross-account isolation, verified-MFA behavior after this fix,
and end-to-end cancellation/re-login remain outstanding.

## Production boundary

No repository evidence confirms that the production Supabase project has been
migrated or that the matching app release has been deployed. Before rollout,
take and verify a backup, inspect the production schema/policies/grants, compare
it with the tested clone, then apply the migration and deploy in the intended
order. Follow the preflight and backout notes in
[`security-migration.md`](./security-migration.md).

The GitHub Actions Playwright workflow remains disabled with `if: false` in
`.github/workflows/playwright.yml`; local results do not imply CI coverage.

## Independent review addendum (2026-10-01)

This review inspected the current source and migration files without applying
database changes or rerunning the previously recorded checks. The previous
fresh audit reported TypeScript success, 10 local tests, and a clean
`git diff --check`; whole-repository ESLint reported 135 errors and 92 warnings,
while `npm run lint` could not start because of the broken global npm launcher.
Build, E2E, and Supabase migration application were not run. Those are prior
results, not fresh results from this review. An older snapshot elsewhere in this
document records a different ESLint count (136 errors and 102 warnings); keep
the counts tied to their respective snapshots rather than treating either as a
current lint result.

The worktree currently contains 57 modified tracked paths and 17 untracked
paths (74 status entries). The earlier 57/13 count is stale because four
additional untracked paths are now present. Existing changes were preserved.

### Findings

- **P2 — Workout-routine sync failures can still produce “Sync complete.”**
  [`AuthContext.tsx`](../src/app/_context/AuthContext.tsx#L222) awaits
  `syncWorkouts()` but ignores its result. The helper returns `null` rather
  than throwing when authorization fails or the `user_settings` read fails
  ([`sync.ts`](../src/app/_lib/sync.ts#L308),
  [`sync.ts`](../src/app/_lib/sync.ts#L314)). The enclosing sync then reaches
  its success toast, so this real partial failure is not surfaced as a sync
  failure. Other food, drink, settings, and workout-history read/write failures
  inspected here do propagate to the failure path.
- **P2 — “Don’t ask again on this device” does not remember an authenticated
  device.** [`login/page.tsx`](../src/app/login/page.tsx#L138) only restores the
  checkbox from `localStorage`, and lines 227–228 only set or clear that marker
  after verification. No auth/session behavior reads it to establish device
  trust or suppress a later challenge; logout also removes it in
  [`AuthContext.tsx`](../src/app/_context/AuthContext.tsx#L242). The label
  therefore promises behavior the control does not provide. The AAL2 check is
  still required; the marker does not bypass it.
- **P2 — Acknowledged changelog version is shared across accounts on one
  browser.** [`UpdateCenter.tsx`](../src/app/_components/update/UpdateCenter.tsx#L229)
  reads one global local-storage value and merges it with the signed-in
  profile's `latest_version` at lines 236–245. The helper then writes the higher
  value to that profile
  ([`changelog.ts`](../src/app/_lib/changelog.ts#L133)). If account A has seen a
  release and account B signs in on the same browser, A's local value can mark
  that release as seen for B and be persisted to B's profile. The profile query
  itself is owner-filtered and protected by RLS; the issue is shared local
  acknowledgement state.
- **P2 — OTP completion can submit more than once while fields remain full.**
  [`login/page.tsx`](../src/app/login/page.tsx#L42) invokes `onComplete` whenever
  the six inputs currently contain six digits, including after editing a
  single digit in an already-complete code. `OtpInput` remains editable while
  verification is pending, and `doMFAVerify` has no in-flight guard
  ([`login/page.tsx`](../src/app/login/page.tsx#L219)). This permits a second
  verification request before the first settles. A single six-digit paste or
  one-time-code autofill is distributed and triggers completion once; the
  concern is subsequent edits/re-entry, not the distribution path itself.
- **P2 — OTP fields have no accessible names.** The six controls rendered in
  [`login/page.tsx`](../src/app/login/page.tsx#L66) have no associated labels or
  `aria-label`; the first field's `autocomplete` hint does not name any field
  for assistive technology. The MFA code entry therefore lacks an announced
  purpose and digit position for screen-reader users.

### Checks that passed by inspection

- Sync toast start is after session, duplicate-sync, and active-owner guards;
  route changes are read through a ref and no longer retrigger sync by being a
  callback dependency. A tab/route change alone does not start a sync toast.
  Success and failure toasts are emitted only after the corresponding sync
  attempt reaches those paths, subject to the workout-routine `null` case above.
- A full six-digit paste from any OTP field and browser one-time-code autofill
  distribute the digits in order. Ctrl/⌘+A clears the six fields and returns
  focus to the first. The login animation disables itself for
  `prefers-reduced-motion`; the checkbox is inside a semantic label and has a
  visible keyboard focus rule.
- Migration `20261001010000_profile_latest_version.sql` sorts after
  `20261001000000_fix_data_reset_defaults.sql`. It adds `latest_version` with
  `IF NOT EXISTS` and grants only select/insert/update on that column to
  `authenticated`. The base schema already declares the column, so the add is
  intentionally a no-op on a fresh schema while the explicit column grants
  restore access after the security migration's revokes. It does not alter
  policies: the existing owner check and `healthsync_mfa_ok()` AAL2 condition
  still govern profile reads and writes. The migration has not been applied to
  a database as part of this review.

### Overall assessment

The sync-toast route-change correction, six-digit paste/autofill distribution,
and migration ordering/grants look sound by inspection. The findings above
should be addressed or explicitly accepted before treating these particular
behaviors as complete. No source changes, tests, build, E2E run, or database
operations were performed for this addendum.

## Final independent push-readiness audit (2026-10-01)

This pass read the repository instructions and prior audit, inspected the
working-tree diffs for the authentication, sync, update, migration, and login UI
paths, and checked the new local-data, sync-policy, server-authorization, and
local E2E files. No source code was changed during this pass. This section
records the fresh checks and the final review findings.

### Findings

- **P2 — An in-flight sync can show stale completion toasts after a route or
  tab switch.** [`AuthContext.tsx`](../src/app/_context/AuthContext.tsx#L142)
  snapshots `suppressToast` only when the sync starts. Its completion callback
  unconditionally schedules “Sync complete” at line 228 without rechecking the
  route or document visibility or cleaning up the timer. Navigating to `/login`
  or `/onboarding`, or hiding the browser tab, during a running sync can
  therefore surface a delayed toast when the sync finishes. The route guard
  prevents a route change from starting a new toast-producing sync, but does
  not silence one already in flight. Also, `syncWorkouts()` at line 222 can
  return `null` on authorization or read failure ([`sync.ts`](../src/app/_lib/sync.ts#L305),
  [`sync.ts`](../src/app/_lib/sync.ts#L314)), and the caller ignores that value
  before showing success. A partial sync failure can be reported as complete.
- **P2 — The “Don’t ask again on this device” checkbox records a marker but
  does not implement remembered-device behavior.** [`login/page.tsx`](../src/app/login/page.tsx#L137)
  reads the marker only to restore the checkbox state; lines 227–228 write or
  remove it after verification. No authentication or MFA-gate decision reads
  it to remember the device or affect a later prompt, and logout removes it.
  The AAL2 requirement remains intact, but the advertised behavior is absent.
- **P2 — A changelog acknowledgement can leak between accounts on a shared
  browser.** [`UpdateCenter.tsx`](../src/app/_components/update/UpdateCenter.tsx#L229)
  reads one global local-storage version and merges it with the signed-in
  profile at lines 236–245. [`changelog.ts`](../src/app/_lib/changelog.ts#L133)
  then stores the higher version to that profile. If account A acknowledged a
  release and account B signs in on the same browser, A’s local value can
  suppress B’s unseen notes and be persisted to B’s profile. The profile query
  is owner-filtered and RLS-protected; the local marker needs account scoping.
- **P2 — OTP verification can submit repeatedly while a request is in flight,
  and the six fields are unnamed to assistive technology.**
  [`login/page.tsx`](../src/app/login/page.tsx#L33) invokes completion whenever
  all six values remain populated, including after editing a digit in a full
  code. The inputs remain editable during verification, and
  [`doMFAVerify`](../src/app/login/page.tsx#L219) has no in-flight guard. Each
  input at lines 67–73 also lacks an accessible name and digit position. Full
  code paste/autofill distribution and Ctrl/⌘+A clearing work by inspection,
  but the OTP requirement is not fully met.

No SQL owner-scope or AAL2 defect was found in the inspected profile-version
migration path. The additive migration follows the reset hotfix, idempotently
adds `profiles.latest_version`, and grants only select/insert/update on that
column to `authenticated`. The preceding security migration revokes broad
profile grants, grants only intended profile fields, and retains owner and
`healthsync_mfa_ok()` predicates for profile reads/inserts/updates. The base
schema also declares `latest_version`, so the additive column operation is a
no-op on a fresh install while its column grants restore access after the
security migration. The migration was not applied to a database in this pass;
runtime behavior remains unverified.

### Requirement status

| Requirement | Result |
|---|---|
| Sync toast should not mislead after route/tab changes | **Not fully met.** A route change does not start another sync, but an in-flight sync does not recheck route or visibility before completion toasts. Workout-routine `null` failures also fall through to success. |
| Six-digit paste/autofill distribution and Ctrl/⌘+A clear | **Met by code inspection.** All six fields receive digits and select-all clears them. Accessible names and protection from duplicate in-flight submission are missing. |
| `profiles.latest_version`, migration order, column grants, owner/AAL2 RLS | **Migration/source wiring consistent by inspection; runtime unverified.** The browser-local acknowledgement is global and can contaminate another account’s profile state. |
| Remember checkbox performs the requested behavior without weakening AAL2 | **Not met.** It saves a local boolean but does not remember the device. No AAL2 bypass was found. |
| Login animation/checkbox accessibility and reduced motion | **CSS/markup checks pass.** The view animation and checkbox transitions are disabled for reduced-motion users; the checkbox has a semantic label and focus-visible styling. Browser keyboard, screen-reader, and motion behavior was not run. |

### Checks performed in this pass

- Branch is `v4.0.0`, tracking `origin/v4.0.0`; the index is clean. The worktree
  contains 57 modified tracked paths and 17 untracked paths. No staging, commit,
  push, reset, or database mutation was performed. `HEAD` is 0 commits ahead
  and 0 behind `origin/v4.0.0`.
- `git diff --check`: passed; Git emitted only line-ending normalization
  notices.
- Local `tsc --noEmit`: passed using `node_modules/.bin/tsc.cmd`.
- `node --test tests/localData.test.mjs`: passed, 10/10 tests.
- Whole-repository ESLint: failed, 135 errors and 92 warnings. This matches the
  previous fresh scan recorded above, and the only ESLint configuration change
  adds an ignored build directory. The count gives no evidence of a net lint
  regression. **New:** no net-new error count is indicated, but no individual
  error is confirmed new from aggregate counts alone. **Pre-existing:** the
  support-page unescaped-entity errors are on unchanged content. **Ambiguous:**
  other errors in modified files need a clean baseline lint run for reliable
  attribution. It is not justified to call all current lint errors
  pre-existing.
- `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e -- --list`
  could not start because the global npm launcher points to a missing
  `npm-cli.js`. Local project binaries worked when called directly. The direct
  production build started but failed because Next could not fetch DM Sans from
  Google Fonts; this does not confirm a successful build.
- Local Playwright `test --list`: succeeded and listed 44 tests in six files.
  No browser tests were executed in this pass. The earlier Edge timeout
  recorded above remains the only prior browser-execution evidence found.
- No Supabase migration was applied and no database policy/grant query was run.

### Steps required before push

1. Fix the four P2 findings above: account-scope the changelog marker, implement
   explicit remembered-device semantics that preserve AAL2 enforcement, add an
   OTP in-flight guard and accessible names, and make toast cleanup route/
   visibility-aware while propagating workout-routine sync failures.
2. Resolve or explicitly baseline the 135 ESLint errors and 92 warnings, then
   rerun lint and record the exact outcome.
3. Get a successful production build in an environment where the configured
   font can be fetched or resolved locally.
4. Run browser flows for OTP paste/autofill, duplicate submission, keyboard and
   reduced-motion behavior, route/tab sync transitions, and two accounts
   acknowledging different update versions.
5. Apply the migrations to the isolated development project after the documented
   preflight; verify the new column grants and owner/AAL2 profile access. Record
   the still-outstanding cross-account and verified-MFA acceptance checks in
   `security-migration.md`.
6. Review the 57 modified and 17 untracked paths as one intended change set and
   decide which belong in the push. This audit is not evidence that any paths
   have been staged or committed.

**Push readiness: not ready.** The review found unmet functional requirements,
and a successful build, browser execution, and application of the latest
migration have not been established.

## Remediation and verification addendum (2026-10-01)

This section records changes made after the final independent audit above. The
older snapshots and their counts remain historical evidence.

### Finding disposition

| Severity | Finding | Current disposition |
|---|---|---|
| P2 | Stale sync toasts after navigation or tab hiding | Fixed in `AuthContext.tsx`: route, visibility, session and owner are checked at display time; route/tab/account changes invalidate the toast epoch, clear sync text and cancel the completion timer. Data sync continues. Browser verification is still blocked below. |
| P2 | Workout read/authorization failure reported as complete | Fixed in `sync.ts`: those failures now throw into the enclosing sync error path. Missing routines remain a valid `null` result. Three focused unit cases passed. |
| P2 | Remember-device checkbox promises unsupported trust | Removed the checkbox, its local marker reads/writes and logout cleanup. Existing local marker data is ignored. No server-bound device trust exists in this architecture; verified-factor accounts still need AAL2 in client policy, protected APIs and RLS. |
| P2 | Global changelog acknowledgement crosses accounts | Fixed with guest and per-user-ID keys. The legacy global key is never read. Profile reads distinguish missing/error states; writes confirm an owner-visible updated row. Local fallback remains available on cloud failure. Guest/two-account key isolation passed a unit test; browser/database validation remains open. |
| P2 | Duplicate OTP verify and unnamed fields | Added a synchronous in-flight guard, disabled fields during verification, labelled six-digit group and digit positions. Existing paste/autofill distribution and Ctrl/⌘+A behavior remain in the source. Browser OTP verification remains open. |

The login view still has reduced-motion rules and a visible OTP focus outline.
The removed checkbox has no remaining keyboard target or unsupported label.

### Checks in this remediation pass

- `git diff --check`: passed; only Git line-ending normalization notices.
- `node_modules/.bin/tsc.cmd --noEmit`: passed.
- `node --test`: 14/14 passed, including changelog identity separation and
  workout-sync failure/empty-state cases. `package.json` now includes all
  discovered Node tests in `npm test`/`test:watch`; the global npm launcher on
  this host remains broken, so the direct Node command was used.
- Local ESLint binary on the whole repository: **135 errors, 87 warnings**.
  The prior 135/92 snapshot is a different worktree state. Of the current
  diagnostics, 31 errors and 20 warnings are in tracked files identical to
  `HEAD` and therefore pre-existing. The remaining 104 errors and 67 warnings
  are in changed or untracked files and cannot be attributed reliably against
  the already modified baseline. No diagnostic was found in the newly added
  changelog-storage or workout-test files, and no new diagnostic is proven by
  this comparison. The aggregate count does not establish a clean lint result.
- `node_modules/.bin/next.cmd build`: stopped at Next's attempted fetch
  of DM Sans from Google Fonts (`fonts.googleapis.com`). The build did not reach
  a successful production artifact; this run does not establish that all code
  build stages pass.
- `node_modules/.bin/playwright.cmd test e2e/login-a11y.spec.ts
  e2e/security-local.spec.ts --project=edge --reporter=line`: 5/5 timed out on
  navigation in Edge. A single-worker login retry with `domcontentloaded` also
  timed out. A final `commit`-wait retry navigated but did not render
  `#viewLogin` within the assertion timeout. The local dev server additionally
  returned 500 for `/serwist/sw.js` because its bundle could not resolve
  `src/app/sw.ts` in this Windows/sandbox run. These runs do not verify OTP,
  reduced motion, toast navigation, or two-account browser behavior. No
  disposable signed-in test accounts were available in this pass.
- Migration files were read in timestamp order:
  `20260929000000_initial_schema.sql`, `20260930000000_security_sync.sql`,
  `20261001000000_fix_data_reset_defaults.sql`, then
  `20261001010000_profile_latest_version.sql`. The base schema has
  `latest_version`; the final additive migration creates it on older schemas
  and grants only its select/insert/update column rights to `authenticated`
  after the security migration's revokes. The profile policies require owner
  identity and `healthsync_mfa_ok()`, whose verified-factor branch requires
  JWT AAL2. No migration or database query was run, so actual DEV/production
  schema, grants and policies are not newly verified. The open owner-isolation
  and verified-MFA acceptance cases remain in `security-migration.md`.

### Git and remaining release gate

Branch `v4.0.0` still tracks `origin/v4.0.0` at 0 ahead/0 behind. The index
is empty. The worktree has 57 modified tracked files and 20 untracked files,
including three added by this remediation (`changelogStorage.ts`,
`syncWorkouts.test.mjs`, `login-a11y.spec.ts`). Nothing was staged, committed,
pushed, reset, stashed or migrated here.

**Push readiness: not ready.** Resolve or explicitly accept the lint baseline,
obtain a successful production build, run the targeted browser flows with a
working browser/dev setup and disposable accounts, and verify the pending
profile migration plus the open owner/MFA cases in an isolated DEV project.
Review the complete existing worktree as one intended release set before push.

## Maintainer verification update (2026-10-01)

The maintainer supplied new evidence after the remediation pass:

- `npm run build` completed successfully with Next.js 16.2.9, including
  compilation, TypeScript, page-data collection and static-page generation. This
  supersedes the earlier failed build attempt in this audit.
- `Invoke-WebRequest http://localhost:3000/serwist/sw.js -UseBasicParsing`
  returned HTTP 200 and the generated Service Worker content. This supersedes
  the earlier local 500 report for that endpoint in the then-current server
  session.
- The maintainer reports that the latest database migration/version has
  already been applied to the production database. No CLI migration output,
  post-apply schema/grant query or policy verification was included in the
  evidence supplied here, so this is recorded as a maintainer report rather
  than independent database verification. Do not reapply it based on this
  audit.
- The Playwright HTML report at `http://localhost:9323/` reports **38 passed,
  7 failed, 0 flaky, 0 skipped (45 total; 4.6 minutes)** for Edge, generated
  2026-10-01 21:54. The failed set contains four settings tests and three
  `security-local.spec.ts` tests. Inspected failure details show the visible
  “What’s new” dialog intercepting clicks intended for Settings and food actions;
  the tested actions timed out before completion. The login accessibility /
  reduced-motion test passed. The failures do not verify the affected browser
  flows as successful, and the report does not establish OTP paste/multiple
  submit, sync-route/tab, or two-account browser coverage.

The successful production build and Service Worker response remove those two
items from the current release gate. Push readiness remains **not ready** until
the seven Playwright failures are resolved and the required OTP/sync and
two-account behavior is verified, the lint baseline is resolved or accepted,
and owner-isolation / verified-MFA DEV acceptance evidence is recorded. The
production migration status is maintainer-reported; confirm the production
schema and grants through a read-only query if a verified database record is
needed. No commands or database changes were performed by this update pass.

### Follow-up: Playwright overlay setup investigation (2026-10-01)

The maintainer asked how to proceed from the seven reported browser failures. The
four settings and four `security-local` setup paths (including the previously
passing cookie-consent case) begin as guest users and should not test the update
center. I updated those test initializers to seed the current guest changelog
acknowledgement. They read `APP_VERSION` from the release module and pass it as
a serializable `page.addInitScript` argument; a Playwright init callback cannot
rely on the imported module variable as a browser global. No application code,
production data or migration was changed.

Evidence and verification:

- The earlier Playwright error snapshot contained the rendered dashboard and an
  open `What's new` dialog, consistent with an unacknowledged guest changelog
  being seeded incorrectly. This supports the test-fixture diagnosis for the
  earlier click-interception failures.
- A focused Edge rerun of `settings.spec.ts` and `security-local.spec.ts`
  started 8 tests but all 8 timed out in `page.goto` before test assertions. A
  follow-up attempt with `waitUntil: 'domcontentloaded'` also timed out at
  navigation; that experiment was reverted. The browser snapshot from the first
  run rendered the app, but these reruns do not verify that the serializable
  changelog marker closes the dialog or that the tests pass.
- `Invoke-WebRequest` returned HTTP 200 for `/dash` via `localhost`, `127.0.0.1`
  and `::1`. A standalone headless Edge probe could not complete navigation and
  reported `net::ERR_ABORTED`; this indicates a browser/server-session issue
  distinct from the HTTP response, but its cause remains unresolved.
- `tsc --noEmit`: passed. `node --test`: 14/14 passed. `git diff --check`:
  passed, with only existing LF/CRLF normalization notices.

**Release gate remains not ready for push.** Repeat the focused Edge tests after
restoring a browser-reachable local server session and confirm the seeded guest
marker removes the update-center overlay. Then rerun the relevant full browser
flows and close the remaining OTP/sync/two-account, lint-baseline and isolated
DEV owner/MFA verification items recorded above.

### Maintainer follow-up: focused Edge rerun passed (2026-10-01)

The maintainer reports that the focused rerun of the eight tests in
`e2e/settings.spec.ts` and `e2e/security-local.spec.ts` completed with **8
passed in 12.0 seconds** on one worker. This supersedes the immediately prior
local-browser navigation timeout attempt for those test cases and confirms the
settings/security-local guest setup in that reported run. The exact environment
and invocation were not included with the result, so this is recorded as
maintainer-provided evidence.

This closes the seven earlier click-interception failures plus the cookie
consent case in the focused suites. It does not by itself verify OTP
paste/autofill and concurrency, sync route/tab changes, signed-in two-account
isolation, or production/DEV database policy behavior. The other audit release
gates remain open; push readiness remains **not ready** until those applicable
checks and the lint-baseline disposition are recorded.

### Maintainer follow-up: manual OTP and account-isolation checks (2026-10-01)

The maintainer reports having manually tested OTP authenticator autofill and
isolation between two accounts. Record these two browser acceptance items as
maintainer-verified; no detailed test transcript, screenshots or disposable
test-account evidence was supplied in this update. Earlier statements that
these two behaviors still lacked any verification are superseded by this
report. The automated E2E evidence for OTP and cross-account behavior remains
limited to the automated cases already listed above.

The remaining verification gates are sync-toast lifecycle on route/tab changes,
DEV database owner/AAL2 RLS evidence, and a resolved or explicitly accepted
lint baseline. The production migration is maintainer-reported as applied;
post-apply schema/grant/policy verification was not supplied here.

### Production schema discrepancy during RLS test (2026-10-01)

The maintainer ran the proposed authenticated-role SQL test against the project
described as Production. It stopped at `UPDATE public.profiles SET
latest_version = latest_version` with PostgreSQL `42703: column
"latest_version" does not exist`. The later `ROLLBACK` in the batch may not have
executed after the error; run `ROLLBACK;` separately if that SQL session remains
open. Earlier SELECT and assurance results were not supplied, so this test
does not establish owner or MFA policy behavior.

This error contradicts the earlier report that the production profile-version
migration was applied to this database. The repository migration
`20261001010000_profile_latest_version.sql` adds the column and its
authenticated column grants, but the actual target schema/history must be
checked read-only before any corrective migration. The application selects and
updates `profiles.latest_version`; until the target column exists, cloud
changelog acknowledgement cannot be confirmed on that target. **Push readiness
remains not ready.** No production change was made by this audit.

The maintainer then supplied a schema query and Table Editor screenshot for
that target: `profiles` has `id` and `display_name`, but no `latest_version`;
the table contains an older `last_seen_changelog_version` text column with
per-account values such as `3.0.0` and `3.1.1`. The local additive migration was
amended to copy those values into the new field only when it is null, while
remaining valid on fresh databases without the old field. No SQL was applied
to Production. The planned owner/AAL2 test can use an existing profile field
for its no-op UPDATE; the version-column migration and runtime verification
remain separate push blockers.

### Production profile preflight supplied by maintainer (2026-10-01)

The maintainer supplied a read-only aggregate query result for the project
described as Production. `public.profiles` has RLS enabled. Effective table-level
SELECT/INSERT/UPDATE privileges for `anon` and `authenticated` are all false;
the table-grant and noninternal-trigger lists are empty. The only profile
policies shown are `healthsync_profile_insert`, `healthsync_profile_select`,
and `healthsync_profile_update`, all for `authenticated` with owner-ID and
`healthsync_mfa_ok()` conditions matching the repository security migration.
The earlier column-grant output limits `authenticated` to `id`, `display_name`,
`full_name`, and `avatar_url`; no `anon` column grants were shown.

This supports applying the prepared additive profile-version migration after
the intended project and recoverable backup are confirmed. It does not prove
the actual `healthsync_mfa_ok()` function body, the migration history, the new
column/grants, or runtime owner/AAL2 behavior. No production SQL was run by
this audit. The maintainer should verify the column and copied values after
application, then rerun direct RLS checks. Push readiness remains not ready.

The maintainer subsequently supplied a post-application privilege query for
`profiles.latest_version`: effective SELECT, INSERT, and UPDATE privileges for
`authenticated` are true, and SELECT for `anon` is false. This confirms the
new column is present and these effective grants are in place on the queried
project. The legacy-to-new value counts and direct owner/AAL2 runtime results
have not yet been supplied, so data backfill and policy behavior remain open.

The maintainer then supplied the value-copy result: seven non-null legacy
account values and seven equal values in `latest_version`. This confirms the
backfill for the seven rows on the queried project. Direct owner/AAL2 runtime
checks and migration-history reconciliation remain open.

The maintainer next confirmed that a target food entry exists in the queried
database (administrative count 1). In an authenticated-role SQL transaction
simulating account B at `aal2`, `healthsync_mfa_ok()` returned true; B's own
profile was visible and accepted a no-op UPDATE (1 row each), while account
A's profile and food entry were invisible and an attempted no-op UPDATE of A's
food entry returned 0 rows. The transaction ended with `ROLLBACK`. This is a
positive direct owner-isolation result for B at AAL2 on the tested rows.
The corresponding B-at-`aal1` denial result, reverse A-to-B direction,
unverified-factor case, and full table/RPC matrix remain unverified here.

The maintainer then supplied B's direct `aal1` result under the authenticated
role: `healthsync_mfa_ok()` returned false, and both own-profile SELECT and
no-op UPDATE returned zero rows. Combined with the B-at-`aal2` result, this
verifies the profile policy's denied-before/allowed-after assurance behavior
for the tested account. The reverse A-to-B owner check and other table/RPC
cases remain outside this direct SQL evidence.

The maintainer then supplied the reverse A-to-B result at `aal1` for an account
without a verified factor: `healthsync_mfa_ok()` returned true, A's own profile
was visible and accepted a no-op UPDATE (1 row each), while B's profile was
invisible and its attempted no-op UPDATE returned 0 rows. This completes the
targeted two-direction profile owner check and the direct profile MFA
before/after check. Food owner isolation was additionally demonstrated B-to-A.
The remaining broader health-table/RPC matrix and migration-history record
were separate from these targeted results. No lint work was started.

The maintainer subsequently supplied the target project's migration-history
query. It lists `20260929000000_initial_schema`,
`20260930000000_security_sync`, and
`20261001000000_fix_data_reset_defaults`, but does not list
`20261001010000_profile_latest_version`. The maintainer executed the latter
SQL manually and supplied post-application column-grant and seven-row backfill
results above. At that point, the observed schema and the Supabase migration
ledger differed. No migration-history repair was executed by this audit.

The maintainer then ran `supabase migration repair 20261001010000 --status
applied --linked` against the linked project reference
`stuqtqlkantewwxhwitg`. The CLI reported the repair complete. A subsequent
`migration list --linked` showed all four local and remote versions aligned;
the supplied SQL result also lists all four versions, including
`20261001010000` with name `profile_latest_version`. This closes the migration
history discrepancy for the queried project. Broader health-table/RPC
acceptance and the lint baseline remain open; push readiness remains not ready.

The maintainer then supplied one read-only SQL transaction covering all five
app tables under simulated `anon`, A-at-`aal1` (no verified factor),
B-at-`aal1` (verified factor), and B-at-`aal2`. The SQL Editor baseline role was
`postgres`; existing A/B row counts were profiles 1/1, settings 1/1, food
3/66, drinks 1/18, and workout sessions 0/7. B at `aal2` saw exactly B's
baseline rows and no foreign rows on every table. B at `aal1` saw no rows on
any table, `healthsync_mfa_ok()` returned false, and the reset RPC was denied
with SQLSTATE `42501`. A at `aal1` saw exactly A's baseline rows and no foreign
rows; `healthsync_mfa_ok()` returned true. The `anon` role received `42501` on
all five tables and the reset RPC. RLS was enabled for all five; health tables
had authenticated CRUD grants and no anonymous CRUD grants. The only listed
policies were the intended owner/MFA policies; both security-definer RPCs were
executable by `authenticated` and not `anon`. Profile table-level grants
remained revoked as designed; the separately verified column grants apply.

This completes direct read-isolation and denied-reset evidence for these tested
identities. A has no workout-session fixture, but B's seven sessions were
visible at `aal2` and denied at `aal1`. The transaction was read-only, so it
did not test INSERT, UPDATE, DELETE on each health table or a successful reset
RPC in that transaction. Earlier targeted no-op UPDATE checks and the
maintainer's app-level reset result remain separate evidence. No production
data change was made by this audit.

### Maintainer follow-up: full Edge suite passed (2026-10-01)

The maintainer supplied a fresh complete Playwright summary: **45 passed in
1.2 minutes on one worker**. This supersedes the earlier 38/45 full run and
the focused 8/8 rerun as the latest E2E result. The run was performed by the
maintainer; this audit did not rerun it independently. Browser-suite coverage
is no longer an open push gate. The current lint cleanup and review of its
resulting diff remain in progress.

### Maintainer follow-up: SQL writes and allowed reset passed (2026-10-02)

The maintainer reports that the SQL write cases and an allowed
`clear_healthsync_data()` reset were tested successfully. This closes the
write/allowed-reset gap noted in the earlier read-only transaction above. The
read-only result remains accurately scoped to reads and denied reset; the
successful write/reset result is maintainer-reported and was not independently
repeated by this audit. The exact per-table operation matrix and test identity
details were not included in the report.

### Maintainer follow-up: current E2E suite and build passed (2026-10-02)

The maintainer reports that the E2E suite and production build also pass on the
current worktree after the reviewed fixes. The exact E2E count and build output
were not supplied; this audit did not rerun either check. The maintainer then
supplied a screenshot of `npm test`: **17 passed, 0 failed**, including the
three workspace-switch failure cases. ESLint remains at 124 errors and 47
warnings; this matches the count before these fixes.
