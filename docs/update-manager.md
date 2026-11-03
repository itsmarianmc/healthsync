# Update Manager — deliberate updates and production verification

Updated November 2, 2026. No deployment or migration was performed.

## Cause and the three separate lifecycles

The previous worker already had `skipWaiting: false`. Installation was not an
unconditional activation bug. Inspection established two application update
entry points: UpdateCenter and Settings independently set the shared Local
Storage boolean `healthsync_pending_reload_after_update`. UpdateCenter accepted
that boolean on **any** controllerchange, without identifying the intended
worker or initiating page. Another tab or stale state could therefore authorize
a reload. Bootstrap also consumed the flag to open the changelog on startup;
that could cause an unexpected sheet to appear. A bootstrap ref combined with
effect cleanup could lose registration listeners during development effect
replay. Settings also reloaded immediately if no waiting worker was found. The sheet
expansion effect restarted on render/callback changes, allowing status changes
to reset its height; expansion is now scheduled only when opening.

Separately, Serwist's installed default cache configuration used network-first,
unversioned HTML/RSC caches and shared precache cleanup. Returning online can
fetch newer HTML/RSC while a worker is still old. This is different from worker
installation/activation and different from an application calling reload.
Cached assets, fresh server output and Next navigation must be considered
together. These are source-established mechanisms reproduced with local
production builds, not a claim that a particular reporter's device was inspected.

## Current behavior

`appUpdates.ts` is the one client update coordinator. Native registration uses
`updateViaCache: none`; the worker URL has no-cache/no-store response headers.
Registration, visibility/online checks and controller changes only announce
availability. No background path sends SKIP_WAITING, navigates or reloads.
Registration is production-only; development HMR is unrelated.

Update Center and Settings share the same explicit update action. The banner
opens Update Center when Update now is clicked, keeping progress/recovery
controls accessible even if the waiting-worker indicator changes during activation. Update now
captures the exact waiting ServiceWorker object in that page, synchronously
requests draft persistence, sends SKIP_WAITING directly to that worker and waits
until that object is activated **and** controls the initiating page. It then
reloads once. Repeated clicks are guarded before awaiting registration. A
15-second activation timeout, redundant worker, rejected draft flush, missing
waiting worker or messaging failure revokes the in-memory intent and restores
controls with a safe error. A later controllerchange cannot revive a failed
attempt. A missing worker no longer silently means reload.

The coordinator has no persistent or cross-tab reload authorization. The old
pending-reload/dismissed-banner keys are retired on registration startup; legacy
changelog helper exports cannot grant reload consent. `healthsync_update_available`
and its existing custom event remain indicator-only compatibility contracts for
Settings. Later defers the currently waiting worker's banner in this document.
Checking again or reading/opening/closing the changelog does not activate it.
A different waiting worker can announce itself. A new browser visit can announce
availability again; Later is not permanent version pinning.

Reload app is available as a compact reload-icon button at the top left of the
sheet, using the shared back-button style and a 44px touch target. The close
button stays at the top right. Reload remains available even without a waiting
worker. The actions section is hidden when there are no update controls,
progress messages or errors to display. Reload also works without
service-worker support. It performs an ordinary reload and warns that
newer server content may load. It does not unregister workers, clear CacheStorage,
clear Local/Session Storage, delete cookies, reset preferences or acknowledge
pending sync. The changelog stays manually accessible and no longer opens from
a persisted startup marker. Its existing read/last-seen synchronization remains.

## Drafts and workspace boundaries

`healthsync:before-reload` is a synchronous **cancelable** window event. Supported
consumers must finish local persistence before returning; storage failure calls
preventDefault to abort the action. CalSyncModal uses its existing workspace and
candidate guards to flush edited existing `calsync_pending` drafts and an
existing matching completed-AI `calsync_active_draft`, including current amount
and unit. It never confirms/logs a draft or transfers it between owners.
The existing Saved Foods selection/review cache is already persisted as edited.

New incomplete manual/recipe editor forms, unpersisted barcode confirmation,
camera files and running AI requests are not serialized generically. The Update
Center/banner explains this; if another dialog is open the coordinator asks for
confirmation before proceeding. Saved records, browser authentication cookies,
preferences and pending sync queues stay intact. The before-reload hook applies
to application-controlled actions; browser refresh/termination, OS process kills
and Next's navigation fallback cannot be reliably intercepted by it. Save or
finish an unsupported form before those actions.

## HTML, navigation and assets

`HEALTHSYNC_DEPLOYMENT_ID` should be a unique, immutable identifier shared by all
instances of one deployment. Vercel's deployment ID or NEXT_DEPLOYMENT_ID can
supply it; local builds fall back to a deterministic source/public/config
fingerprint. It is not APP_VERSION: two builds of a release can differ. A local
fingerprint is not a cluster deployment strategy; production should provide the
explicit identifier. `NEXT_PUBLIC_HEALTHSYNC_BUILD_ID` is generated by config,
not an independent setting. The generated worker receives the same build value.

Next's `deploymentId` provides deployment-tagged asset URLs and navigation skew
checks. It does **not** route requests to retained deployments. Next 16.2.9's
client consumes and removes the server-injected data-dpl-id attribute during
startup; production tests identify documents from their emitted asset URLs.
When an uncached navigation reaches an incompatible server, Next can fall back
to a coherent full navigation. Already-prefetched matching routes may continue
using the existing build. This is a consequence of explicit navigation, not a
background Update Manager reload.

Worker cache rules, before the retained default font/image rules:

- Same-origin API calls and non-asset cross-origin service calls are network-only.
  Owner/auth responses are not used as offline runtime fallbacks.
- RSC is network-only, avoiding reuse of old Flight payloads across deployments
  or authentication states. Next's own in-memory router cache still applies.
- Navigation is network-first in `healthsync-documents-<build>`. Only matching
  X-HealthSync-Build responses for the public local-first shells `/`, `/dash`,
  `/food` and `/drinks` can enter that cache. A new server response is returned
  for a full navigation but cannot poison the old worker's offline shell cache.
  Login/account/server-private documents are excluded. Navigation preload is
  disabled so it cannot introduce a second response source.
- Precache uses `healthsync-precache-<build>` with no cross-build cleanup.
  Content-addressed Next static assets also use a shared immutable cache and
  can be recovered from retained current/legacy Serwist precaches with the dpl
  query removed. An old tab can therefore read an already-precached old chunk
  even after a new worker controls it. The worker's offline error page comes
  from its own precache, not an arbitrary cache match.

Caches can be evicted by the browser or storage pressure. Retention is local,
not a promise of permanent asset availability; it currently favors compatibility
over automatic cross-build garbage collection. Do not implement routine cache
clearing as a refresh mechanism. Use a bounded retention policy only with actual
live-client/deployment compatibility evidence.

For reliable old tabs across devices, the host/CDN must retain and route to old
immutable assets and compatible HTML/RSC/server endpoints for its support window.
Use atomic deployments, an immutable deployment ID and hosting-level skew
protection where supported. Mutable external CSS/font/image URLs can also
change independently; this repository cannot pin an external host's responses.
No remote hosting configuration or old-asset retention was inspected or changed.

## Browser limits

A waiting worker may activate automatically when no controlled clients remain,
including after a full close/reopen. Fresh document requests can load the latest
server deployment even if the previous worker was deferred. Strict opt-in across
cold starts requires versioned hosting and request routing/asset retention, not
activation blockers or a service-worker boolean. Old, already-open clients from
before this fix still execute their old controllerchange handlers until they
reload; the new code cannot rewrite a running old tab.

Official references reviewed alongside the installed package source:

- [Service Worker activation algorithm](https://www.w3.org/TR/service-workers/#activation-algorithm)
- [Next deploymentId](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId)
- [Next self-hosting/version skew](https://nextjs.org/docs/app/guides/self-hosting#version-skew)
- [Serwist worker lifecycle options](https://serwist.pages.dev/docs/serwist/core/serwist)

## Reproducible local production checks

Run `node scripts/verify-update-production.mjs` with Edge installed at the
repository's configured Windows path. It creates two real Next production builds
with different deployment IDs under ignored `.update-test/<run>/a` and `b`, then
runs `next start` on loopback ports 3211/3212 behind a switchable origin on 3210.
It restores Next's generated tsconfig additions only when no concurrent semantic
user edit occurred. It does not replace the main `.next` output or deploy.
The dedicated Playwright config avoids the development server. Test transport
control exists only in the local test proxy, never the application.

Expected versus observed with production Edge:

| Scenario | Expected and observed |
|---|---|
| Availability → Later → continued use | Worker waits, current page state remains, Settings remains usable; no application activation/reload. |
| Open/read/close changelog | Waiting worker stays waiting; no update consent. |
| Explicit Update now, two tabs | Initiator reloads into build B; other tab retains its build-A document and sentinel after controllerchange. |
| Ordinary Reload app, no pending update | Action remains accessible; fresh build B may load; saved data/cookie/preferences/queue/selection remain. |
| Full close/reopen | Browser can activate B naturally; new document is coherent B. |
| Offline startup | Cached matching build-B app shell starts offline with saved records/drafts. |
| Failed activation | Simulated worker message failure shows recovery copy; controls re-enable and later controller events stay quiet. |
| Stale markers | Old flag is retired on startup and cannot cause live controllerchange reloads. |
| Server/navigation compatibility | With prefetch isolated, Next navigates coherently across deployment skew; old precached hashed assets remain readable. |
| Drafts/data | Existing draft amount is flushed by the cancelable event and survives update; selection, pending-food queue and records remain. Cookie retention is checked with a fixture cookie, not a live Supabase session. |

Six coordinator unit cases additionally cover repeated clicks, exact-worker
matching, foreign controller changes, activation timeout, late events after
failure, and cancellation on draft persistence failure or declined warning.
A real browser/PWA on physical iOS and OS-level browser process termination were
not available. Closing every page while retaining a BrowserContext verifies
zero-controlled-client activation, not every OS restoration mode. Real camera,
AI requests, Supabase sessions/RLS and deployment/CDN retention remain untested.


## Check results

- `npm test`: 158/158 pass, including six update coordinator cases and the
  existing push worker tests updated for the build-scoped cache rules.
- Two distinct Next production builds and six production lifecycle tests: pass
  using the dedicated command above. A repeated run in reused output directories
  hit Turbopack's internal Google-font resolver error; fresh per-run directories
  completed successfully. Neither development HMR nor mocked workers establish
  the production lifecycle result.
- `npx tsc --noEmit`: pass.
- Focused ESLint on the new coordinator, UpdateCenter, worker, configuration,
  production harness and tests: pass. Full `npm run lint` retains existing
  repository debt: latest run 115 errors / 49 warnings. Existing Settings and
  CalSyncModal lint debt remains outside the focused changes.
- Existing Settings/image-picker/push browser checks: 25/27 pass. The two push
  failures assert older copy: `Enabled · saved to your account` versus current
  `Enabled`, and `Add to Home Screen` versus the existing workspace's
  `Add HealthSync to your home screen…` text. The Notifications code was preserved.
- Task-scoped `git diff --check`: pass. The full working-tree check still flags
  two pre-existing/concurrent Settings footer whitespace lines, preserved here.

No physical iOS, live authenticated Supabase round trip, production CDN routing
or remote deployment checks were performed. Authentication preservation checks
use a fixture cookie; the update code never changes the authentication layer.

Last verified production build IDs: `update-test-1793643274153-a` and `update-test-1793643274153-b`. The worker identity handshake confirms both tabs
use worker B after explicit activation while the non-initiating document remains A.

New documentation links pass local-path checks. Two historical migration links
in hosting.md refer to absent checkout files; those unrelated links were retained.

The subsequent shared-sheet consolidation reran both production builds and all six update scenarios successfully, including foreground intermediate-motion sampling of Update Center. See [shared-sheets.md](shared-sheets.md) for the final modal inventory and verification record (including the current full-repository lint debt).
