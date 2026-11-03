# Shared sheets and modal inventory

## Foundation and lifecycle

Every standard bottom sheet uses `src/app/_hooks/useDraggableSheet.ts`, including
CalSync, both DropSync dialogs, workout exercise details and active workouts.
FoodLibrarySheet is a food-specific markup wrapper around that hook; unrelated
features do not import it. `useSheetViewport` owns visible-viewport geometry,
`useSheetDragGestures` owns gesture arbitration, and the neutral `dialogLayers`
module owns blocking layers and reference-counted page scroll locks.

The animation phase (`data-sheet-phase`: closed, opening, open, closing) is
separate from the resting sizing state (`stateRef`: closed, open, expanded).

### Content changes and food review

CalSync, DropSync and barcode confirmation use `useSheetSteps` to retain the
outgoing pane until the 380ms horizontal transition completes. Only the current
pane accepts focus/input; the outgoing pane stays painted and inert until it
leaves. The track animates to the incoming pane's measured height, and inactive
panes do not contribute to the resting sheet height. Reduced motion completes
without the slide. Interrupted steps cancel obsolete completion cleanup.

Compact sheets animate content-driven growth and shrink with a separate height
animation. Measurements preserve its remaining duration rather than cancelling
or restarting the full animation. Keyboard/viewport geometry stays immediate;
dragging, closing and unmounting cancel outstanding height motion. Expanded
sheets retain their viewport-sized height. During a step transition the outer
sheet follows the already-animated track height without adding another delay.

Finalize opens `FoodReviewEditorSheet` for food/recipe editing above the intact
preview; barcode manual editing uses the same child sheet. The parent stays
inert until the editor's closing animation completes. Save applies the reviewed
values without logging; Cancel, Back, Escape and backdrop return to the original
preview. Existing workspace guards and barcode read-only rules still apply.

November 3 content follow-up: 22 focused Edge checks passed with mocked
transports. Four final cases also passed after adding explicit 30g Save/Cancel
preservation, rapid step reversal and reduced-motion step coverage. The resize
probe checks intermediate rendered heights during both growth and shrink, and
the step probe checks that outgoing content remains painted and inert during
movement. TypeScript and focused helper/DropSync/motion-test lint passed; full
lint remains at 110 errors and 53 warnings. No physical-device checks were run.

### Entrance and exit

1. Opening captures the opener, registers the blocking layer, locks the page,
   reveals the overlay and places the panel below the viewport. Closed persistent
   overlays retain layout while hidden and inert, so child wheels can initialize
   their scroll positions. They cannot accept early input or focus.
2. Two tracked animation frames commit the initial layout and measure header,
   body overflow, footer, padding and the current CSS/visual-viewport limit. The
   initial compact/expanded height is chosen **before** entrance motion starts.
3. A Web Animations transform moves from `translateY(100%)` to zero. The default
   is 420ms with `cubic-bezier(0.34, 1.15, 0.64, 1)`; configured feature timing is
   retained. CSS backdrop fading runs alongside it. Parent `scale`/`translate`
   remain separate properties.
4. Opening remains active until the animation's `finished` promise resolves.
   Content observations queue a height refresh without cancelling/replaying the
   entrance. Settled viewport changes follow the visible viewport directly.
5. Closing captures the currently rendered transform, then animates downward to
   110% (default 360ms). The overlay still blocks pointer input, the parent remains
   inert and the body lock stays held throughout exit. Only completion releases
   the layer/lock, restores eligible focus and invokes `onClose` once.
6. Each new motion invalidates obsolete frames, animations and callbacks. Reopen
   during exit reverses from the rendered transform and cancels the old close
   completion. Unmount cancels work and releases its own layer/lock. A duration
   plus 120ms fallback covers lost completion delivery; it is shared rather than
   a feature-specific dismissal timer. Reduced motion completes in a microtask.

The requested initial input receives focus on the committed frame after entrance
completion, avoiding focus panning into a moving field. Closing retains Tab and
programmatic focus containment until completion. Completed-close restoration
observes the opener becoming visible again (header actions temporarily hide);
a new dialog cancels that request, and a shared one-second cleanup bound prevents
a lingering observer if the opener never returns. This observes layout changes;
it does not delay scrolling or repeatedly call scrollIntoView.

The animation API and completion contract are described by
[Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)
and [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished).

### Configuration

| Option | Use |
|---|---|
| `onClose` | Business completion after exit; refresh data or unmount here |
| `onCloseStart` | Optional immediate state notification; Update Center can accept a new open request during exit |
| `initialExpanded` | Full initial height without an expansion timer; Update Center, routines/editors, workout history, supplements, bug reporting |
| `expandable: false` | Compact creation chooser; ignores expanded-modals preference |
| `getNaturalHeight`, `getExpandedHeight` | Feature limits inside the shared visible-viewport clamp |
| transition/close duration and easing | Established feature motion, including 350ms food-sheet timing |
| `additionalTransitionProperties` | Parent scaling independently of entrance translation |
| `initialFocus`, `restoreFocus` | Input/heading target and deliberate chooser-to-editor focus transfer |
| `open`, `close`, `refreshHeight`, `snapToExpanded` | Idempotent lifecycle and sizing operations; internal content navigation must not call `open` to replay entrance |

Do not write a competing panel transform, transition, `visible` class or body
lock in a standard consumer. Static below-screen initial styles are harmless;
the foundation owns committed motion. Do not add delayed `snapToExpanded` calls.
Use a `.modal-body` direct child for intrinsic overflow measurement. Carousels
must keep inactive pages from contributing height or accepting interaction.

`dialogLayers` keeps covered parents mounted, inert and hidden from assistive
technology. Only the top blocking layer can handle Escape or focus trapping.
Exit layers remain blocking until completion. Read-only dialogs focus their
panel when there is no visible focusable control. Centered exceptions use
`useBlockingDialog` to share this ownership without adopting sheet translation.

### Established causes

The old hook cleared its opening flag when the CSS transition **started**.
Its queued height refresh and ResizeObserver/MutationObserver callbacks then
temporarily wrote `transition: none`, cancelling the in-flight transform and
snapping to its final value. Update Center's 90ms expansion and several 80ms
workout/supplement/report expansion timers also rewrote that transition during
entrance. CalSync and DropSync had independent height/gesture/timer lifecycles
with the same competing style ownership. Exercise details and active workouts
used another independent animation implementation. A separate header-action
200ms hide callback could also outlive an interrupted entrance and permanently
hide the Update Center entry point. Header show/hide operations now cancel their
obsolete frames/timers and reverse from the current width.

Settings' parent scale/translate transitions are configured through the shared
sheet hook. Height remeasurement removes only height/transform transitions and
preserves these configured properties, so opening Report a Bug cannot snap the
covered Settings panel directly to its smaller size. A regression samples the
parent's intermediate scales on opening, returning and reopening, with a local
iframe response; it does not exercise the remote report form.

November 3 follow-up: the parent-scale regression failed before the fix (zero
intermediate scales) and passed afterward, along with the existing nested
Settings motion test (2/2 in Edge). These used the real-component fixture with
mocked transports and a temporary config omitting the unused development server
and route warmup. TypeScript passed; full lint still reports 110 errors and 53
warnings. The Settings footer's two existing trailing-whitespace lines remain.

A foreground requestAnimationFrame probe reproduced What’s new with **zero
intermediate positions** before the fix. The same probe after the fix observed
dozens of intermediate positions. The regression suite checks sampled rendered
transforms on entrance **and exit**, and final placement, rather than checking
only a class or transition declaration. Production sampling explicitly brings
the initiating tab to the foreground; background-tab frame throttling cannot
establish smooth motion.

## Inventory and verification ledger

Audited application-wide using dialog roles, overlays, portals, modal markup,
imperative transforms, frame/timer callbacks and their consumers. This table
lists unique dialog presentations; shared content modes are recorded together
where they do not open another sheet. All paths below are under `src/app/`.

Expected for standard rows: off-screen entrance, sampled intermediate movement,
settled placement and downward exit; covered parents retain DOM/state. **M**
means observed through a real application entry point in Edge using real
components/providers with mocked transports (`e2e/sheet-motion.spec.ts`). **R**
adds explicit reopen/return coverage. These are desktop/mobile emulation, not
physical iOS results. The command-results section records final run status.

| Dialog / component | Real entry point | Foundation | Observed coverage |
|---|---|---|---|
| What’s new / UpdateCenter | Dashboard update button; Settings update action | shared sheet, initially expanded | M/R; production foreground motion; delayed entries; interruption |
| SettingsModal | Dashboard/Food/Hydration Settings buttons | shared sheet | M/R; nested return |
| GoalModal in SettingsModal, manual/calculated | Set Goal / Calculate Goal | shared sheet, custom natural height | M; both modes and return |
| Logout confirmation in SettingsModal | Account Logout | shared sheet | M/R; cancelled without logout |
| Delete-account confirmation in SettingsModal | Delete Account | shared sheet | M/R; cancelled without deletion |
| ReportBugModal | Report a Bug | shared sheet, initially expanded | M; iframe transport blocked, container only |
| NotesModal | About / Licenses | shared sheet | M; nested return |
| CustomSupplementsModal | Manage custom supplements | shared sheet | M; editor return |
| CustomSupplementEditorModal, add/edit | Add supplement / existing item | shared sheet | M/R add; saved definition then reopened Edit through manager |
| SupplementsModal | Extra actions → Supplements | shared sheet, initially expanded | M/R |
| My Routines / WorkoutModal | Extra actions → Training | shared sheet, initially expanded | M; children retain parent |
| Create/Edit workout in WorkoutModal | New routine / routine menu Edit | shared sheet, initially expanded | M; both presentations |
| AddExercisesModal in WorkoutModal | Add exercise in routine editor | shared sheet, initially expanded | M; nested return |
| SortExercisesModal in WorkoutModal | Routine menu → Sort exercises | shared sheet | M; nested return |
| GifModal exercise details in WorkoutModal | Exercise image/header | shared sheet | M; overview/steps stay internal |
| ActiveWorkoutModal in WorkoutModal | Start workout; mini-workout restore | shared sheet | M/R; minimize retains session; rating is an internal step |
| WorkoutHistoryModal | Extra actions → Workout history | shared sheet, initially expanded | M |
| ActivityStatus main | Dashboard activity badge | shared sheet | M |
| ActivityStatus duration | Keep this status | shared sheet | M; nested return |
| ActivityStatus custom dates | Duration → Custom | shared sheet | M; nested return |
| CalSyncModal, upload/context/analysis/finalize | AI choice, image link/picker, pending food draft | shared sheet (migrated) | M/R; result changes retain panel; food/recipe review and draft persistence regressions |
| CalSyncModal description child | AI → Describe Text; Extra actions → Describe Food | shared sheet (migrated) | M; submit closes child without dismissing result |
| AiMethodModal | Food AI button; Dashboard quick add | shared sheet | M; native picker remains in initiating click |
| CalHistoryModal | Food History | shared sheet | M |
| BarcodeSearchPopup camera/confirmation/manual editing | Extra actions → Scan Barcode | shared sheet | M/R; delayed mocked OFF response; internal steps never replay entrance |
| BarcodeScanner standalone branch | No production caller: current popup embeds its video | shared sheet | Component harness M/R only; not claimed as a real app entry |
| CustomFoodsModal manager | Extra actions → Create food | FoodLibrarySheet → shared sheet | M; list remains mounted |
| FoodCreateChoiceSheet | Manager → Create food | FoodLibrarySheet, compact | M/R; expanded preference does not enlarge chooser |
| FoodCreationSheet, Food/Recipe | Chooser → Food / Recipe | FoodLibrarySheet → shared sheet | M; separate dialogs, both modes; focus transfer and dismissal paths |
| SavedFoodsModal search/favorites/batch review | Extra actions → Saved Foods/search | FoodLibrarySheet → shared sheet | M/R; review/tab navigation retains entrance and selection |
| FoodDetailSheet | Saved/custom food row | FoodLibrarySheet → shared sheet | M; parent preserved |
| FoodEditSheet, food/recipe | Food details → Edit | FoodLibrarySheet → shared sheet | M; food edit motion; recipe edit functional regression |
| FoodDateTimeSheet | Batch review timestamp | FoodLibrarySheet → shared sheet | M; wheels, focus and cancelled gestures |
| DropSyncModal picker/amount | Hydration add; Dashboard hydration quick add | shared sheet (migrated) | M/R; amount is an internal carousel step |
| DropSync HistoryModal | Hydration History | shared sheet (migrated) | M/R |

### Intentional exceptions and non-modal overlays

| Surface | Reason / owning implementation | Verification / limits |
|---|---|---|
| CookieBanner preferences | Centered consent settings, not a bottom sheet. Keeps existing CSS fade/center translation; `useBlockingDialog` shares stacking, focus, Escape and locks | Open/close through Change settings; nested Settings remains covered; consent values unchanged until Save |
| Legal Linkout | Centered external-navigation confirmation, preserves the existing presentation and Continue/Go Back semantics; `useBlockingDialog` shares blocking ownership | Legal Terms external Gemini link → Go Back; no external navigation sent. Visual styling may depend on external global assets; isolated transport tests do not certify those assets |
| Onboarding / onboardingOverlay | Full-page route with a horizontal setup carousel, not a dismissible bottom sheet | Real /onboarding entry and Next; existing slide/inert boundaries retained |
| Onboarding Tooltip portal | Anchored guided-tour spotlight, uses target positioning plus scale/opacity | Existing `__showTooltip` event contract, target text, backdrop dismissal; not a sheet entrance |
| RoutineContextMenu | Anchored routine action menu, scale/fade; moving it to the bottom would change interaction | Real menu → Sort/Edit; menu availability/return checked |
| Header actions | Existing width/opacity presentation, with cancellable show/hide jobs | Repeated early-open/close keeps Update Center reachable and restores focus |
| Extra actions grid | Anchored three-column menu, not a blocking sheet | Existing square/layout tests in both themes and short/rotated viewports |
| Native confirm/alert prompts | Browser-owned data deletion, discard, reset/import, update unsaved-work warnings | Existing feature tests mock acceptance/cancellation; no custom animation claim |
| Toast, AI detection indicator, pull-to-refresh indicator | Non-modal live status/progress; must not trap focus or own a blocking lock | Existing tracking/update suites; excluded from sheet entrance requirements |
| SplashScreen and shared/Tooltip | Legacy components with no current application imports | Source audited; no reachable application entry point or device behavior claimed |
| MFA gate / login / account | Dedicated page/gate flows, not modal overlays | No sheet migration; auth boundaries unchanged |

## Verification and device checklist

### Local results — November 2, 2026

| Command / check | Observed result |
|---|---|
| `npm test` | 158 passed |
| `HEALTHSYNC_FOOD_FIXTURE=1 npx playwright test e2e/saved-foods.spec.ts e2e/ai-workspaces.spec.ts --workers=2 --reporter=line` | 50 passed; also passed together with the then-20-case motion suite (70 total) |
| `npx playwright test e2e/sheet-motion.spec.ts --workers=2 --reporter=line` | Final 21 passed, including sampled entrance/exit, early interruption, exit focus, centered exceptions and dormant scanner harness |
| Reduced-motion chooser `--repeat-each=5 --workers=1` | 5 passed |
| Settings, goals, hydration history and native image-picker specs against `BASE_URL=http://127.0.0.1:3210` | 22/23 initially passed; hydration color snapshot sampled an in-flight global CSS transition. The test now awaits actual transition completion and blocks unrelated external assets; all 3 hydration cases passed on rerun. All 23 distinct cases have passing observations |
| `node scripts/verify-update-production.mjs` | Both final production builds passed; 6/6 update scenarios passed with actual foreground Update Center movement sampled |
| Final production IDs | `update-test-1793643274153-a`, `update-test-1793643274153-b` |
| `npx tsc --noEmit` | Passed; production builds also type checked |
| Focused ESLint: shared hooks/layer/header utilities, migrated hydration dialogs, UpdateCenter and new browser tests/fixtures | Passed |
| `npm run lint -- --format json --output-file .sheet-lintfull.json` | Existing full-repository debt remains: 111 errors, 53 warnings. Shared foundation/new tests are clean; existing refs/state-in-effect and other feature lint debt is not represented as a clean full lint run |
| `git diff --check` | Full tree flags two preserved Settings footer whitespace lines (1058, 1069); check excluding that pre-existing footer file is clean, as is a whitespace scan of new task files |

Earlier checks against the existing development server also encountered page-load
timeouts on external resources. Final feature checks used the isolated local
production server; no remote deployment, database migration or live account
mutation was performed. Browser tests use transport fixtures for account/AI/OFF
requests; camera decoding uses a deterministic fake stream/reader.

The motion suite samples foreground rendered transforms over time, requires
multiple distinct intermediate positions, checks final placement, and attaches
sample JSON. It covers first/reopen, persistent/conditional/nested sheets,
compact/expanded preferences, short portrait/landscape/desktop sizes, delayed
content, viewport resize, interrupted/reversed motion, effect replay, unmount
cleanup and reduced motion. Saved Foods regression tests additionally cover
body/header drags, cancellation, child scrollers, wheels, synthetic visual
viewport keyboard/panning, state preservation and both themes.

Physical iOS Safari/PWA is **not verified**. On a device:

- Open/reopen What’s new, Settings, Saved Foods, both hydration dialogs and a
  nested editor in portrait, landscape and expanded preference; watch the full
  entrance and exit with default/reduced motion.
- Focus Saved Foods search, type/clear, dismiss/reopen the software keyboard
  repeatedly, rotate and change browser toolbars. Header/search/close remain
  visible, query/queue/scroll survive, and the underlying page stays locked.
- Scroll long content mid-list with momentum, then test both boundaries. Native
  bottom bounce and the documented custom elastic fresh top pull must remain
  distinguishable; a bounce alone must not dismiss. Check handle drag, cancelled
  touches, horizontal chips, inputs and date/time wheels.
- Open a child during parent motion and dismiss by Back/Close, Escape where a
  hardware keyboard is available, backdrop and intentional handle pull. Only the
  top dialog acts and parent state/focus return correctly.
- Open cookie preferences above Settings, dismiss them, and verify Settings
  remains mounted and the page remains locked until Settings itself finishes.

See [architecture](architecture.md#modals-and-sheets),
[food-sheet verification](food-sheet-verification.md) and
[Update Manager](update-manager.md) for the preserved viewport/gesture/data and
two-production-build update contracts.
