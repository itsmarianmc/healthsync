# Food and shared-sheet verification — 2026-11-02

This record describes local checks, not deployment or database evidence. No
migration was applied and nothing was deployed. The pre-existing missing migration
link in food-library.md was replaced with a dated checkout-status note. Existing and concurrent user
edits were retained, including unrelated Settings/Weather/CalSync changes.
Screenshots were described in the request but image attachments were not
available to inspect in this run. The keyboard sequence was modelled with
visual-viewport events; it was not reproduced on physical iOS.

## Established causes

1. Barcode mapping retained nutrients and a category-derived g/ml default but
   discarded quantity/serving metadata. Confirmation treated the amount as
   canonical without converting a selected unit. The new mapper separates
   source nutrition and product amount choices, using shared conversions.
2. Custom Food selected FoodEditor/RecipeEditor inside its own conditional
   body, replacing the manager list. Creation now mounts a separate child
   after chooser closing, retaining the inert parent DOM.
3. The menu used width plus content-sized grid rows and only a maximum height;
   three minimum-height rows and padding produced a rectangle. Equal explicit
   border-box dimensions now constrain it in both axes. Icon/button intrinsic
   sizing, padding and shrinking are constrained explicitly.
4. Food-library overlays combined a layout-viewport-derived bottom inset with
   visual-viewport height, while shared expansion used innerHeight. Offset
   scrolls also repeatedly requested height measurement; overflow-only body
   locking allowed browser focus scrolling. A shared visual-viewport frame,
   size-only remeasurement, preventScroll focus and fixed-body/root lock remove
   these competing mechanisms. This is a code diagnosis and synthetic browser
   regression result; physical Safari's keyboard behavior remains unverified.
5. Natural height used offsetHeight of a constrained flex sheet, omitting body
   overflow. Refresh could also be ignored during opening and expanded sheets
   did not update their inline height. Committed body overflow is now measured
   with surrounding chrome and clamped to the current usable height. Child
   resize/mutation observations and viewport events trigger remeasurement.
6. Content pulls prevented default before the drag threshold, and shared CSS
   used overscroll-behavior: none. Containment now allows local native feedback;
   gestures already consumed by content remain native. Only a fresh top-edge
   downward pull uses the documented elastic fallback and deliberate handoff.

## Acceptance record

“Observed” below means deterministic local Node/Edge checks. Desktop viewport,
touch injection and a synthetic visualViewport do **not** establish native iOS
keyboard, momentum or rubber-band behavior.

| Case | Expected | Observed / remaining |
|---|---|---|
| 1 | Equivalent mass choices retain nutrition | Node and mocked Edge: g/oz switching retains calories; kg and normalized quantities checked. |
| 2 | Equivalent volume choices retain nutrition | Node and mocked Edge: ml/US fl oz/cup switching retains calories; L conversion checked. |
| 3 | Known serving/piece relationship calculates correctly | 2 pieces (30 g) gives 15 g/piece; named cookies, cups and direct serving-only nutrition checked. |
| 4 | Unusual units remain visible; unresolved mapping blocks logging | Unknown scoop label stays selectable; explanation and disabled confirmation checked. |
| 5 | Missing density never implies g = ml | Cross-dimension cup/ounce conversions reject without a paired product relationship; explicit cup weight checked separately. |
| 6 | Reload retains units and provenance | Catalog JSON, saved snapshot, selected cups/pieces and barcode provenance round-trip through Node and Edge reload. |
| 7 | Food creation uses a distinct dialog over mounted manager | Chooser closes, createFoodModal opens, manager DOM/text remains mounted and inert; focus transition checked. |
| 8 | Recipe creation, save and dismissal return correctly | Both editors tested through Cancel, Back, Escape, backdrop and handle drag; manager scroll/focus retained. Recipe calculations and one-write save latch checked. |
| 9 | Square panel and icons; short-screen actions reachable | Computed bounding boxes pass at 390×844, 844×390 and 320×480, both themes, reopen/rotation and scrolling. Physical safe-area/iOS check remains. |
| 10 | Search stays visible above keyboard; page locked | Simulated viewport height/offset keeps search and header visible, same input node and fixed body. Real keyboard remains untested. |
| 11 | Repeated keyboard cycles/rotation retain state | Three simulated open/close cycles plus rotation retain query, selection and input DOM. Real Safari toolbar transitions remain untested. |
| 12 | Camera-to-confirmation content sizes correctly | Manual/short entry, long delayed mocked products, validation, units and rotated viewport checked; confirmation footer reachable. |
| 13 | Middle-content scroll consumes gesture | Edge touch injection scrolls content without sheet movement. Native physical-iOS momentum remains untested. |
| 14 | Boundary feedback and deliberate drags coexist | Edge checks top elastic movement, cancellation, dismissal and independent header/handle dragging. Physical native bottom bounce and momentum remain untested. Top-start downward feedback is custom, not native bounce. |
| 15 | Nested/interactive/cancelled/covered gestures cannot dismiss accidentally | Edge checks inputs, horizontal gestures, date wheels, cancellation and inert covered parents. Device touch-selection/nested-scroller checks remain. |

Expanded-modals preference, compact choosers/date picker, reduced motion,
portrait/landscape/short layouts and both themes are covered in the food suite.
Settings, goal sheets and image picker are checked as other shared consumers.
The earlier Settings test pressed Escape while its closing child still owned a
capture listener; it now waits for unmount. The goal small-drag assertion now
uses 8px, below the existing 12px velocity-dismiss gate, rather than a fast 20px
fling that could legitimately close. Existing review tests were aligned with
current scrolling CSS and the workspace's removed Add food button.

## Commands and results

- `npm test`: 152/152 pass, including ten new barcode cases.
- `npx tsc --noEmit`: pass.
- `HEALTHSYNC_FOOD_FIXTURE=1 npx playwright test e2e/saved-foods.spec.ts --reporter=line --workers=2`: 43/43 pass.
- `npx playwright test e2e/goal-modal.spec.ts e2e/settings.spec.ts e2e/food-image-picker.spec.ts --reporter=line --workers=2`: 20/20 pass.
- `npm run build`: pass with normal subprocess access. The sandboxed Turbopack attempt stalled and was interrupted; the normal-access build completed.
- `npm run lint`: fails on existing repository issues (latest run: 123 errors, 49 warnings; initial baseline: 124 errors, 51 warnings). Focused changed code has the existing BarcodeSearchPopup reset-effect lint error; other changed TypeScript/tests pass focused ESLint.
- `git diff --check`: two unrelated concurrent SettingsModal.tsx lines have trailing whitespace (1083 and 1094); task-owned changes pass the scoped check.

Local socket access required normal-access browser execution. External services
were mocked in the food suite. No live OFF response, cloud schema, Auth/MFA/RLS,
real camera hardware or physical iOS acceptance is claimed.

## Physical iOS checklist (not run)

Use Safari and the installed PWA on a real iPhone, plus iPad if available:

1. In both themes, open/reopen the extra menu in portrait, landscape and a short
   browser viewport; confirm square panel/circles and scroll to every action
   above navigation and safe areas.
2. In Saved Foods, keep a query/tab and queued selections. Focus, type, clear,
   blur and dismiss/reopen the keyboard repeatedly, collapse/expand toolbars,
   then rotate with keyboard open. Header/search/Back must stay visible, results
   scroll internally, background stays locked and state survives.
3. Scan a mocked/test product with long text, serving units and missing
   conversion, then change units and rotate. Confirm full usable confirmation
   height and reachable footer above the keyboard.
4. Fling long content in the middle and toward both edges. Confirm native
   momentum and bottom rubber-band feedback. A scrolling gesture reaching the
   top must finish before a new deliberate downward pull moves the sheet.
   Verify the small top-start elastic fallback springs back, and only deliberate
   distance/velocity or handle/header pulls dismiss.
5. Repeat with nested review-card scrollers, horizontal chips, date wheels,
   focused inputs and text selection; cancel/multitouch a pull. No child that
   can consume scrolling may transfer it. Covered parents must remain inert.
6. From Custom Food, create/cancel/save Food and Recipe via every dismissal
   path. Confirm manager scroll and focus return and no duplicate definition.
