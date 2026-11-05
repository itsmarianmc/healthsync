# Personal food library — October 30, 2026

The food plus menu in CalSync and AppShell offers AI text, camera and image
upload, manual creation, explicit barcode scanning and Search. Search is the
only food-library shortcut in this menu; Favorites is available as a tab inside
Saved Foods. Create Food also offers recipes. These are existing global sheets, without a
new route. External lookup remains limited to the explicit scanner; Search and
Favorites never make Open Food Facts or Gemini search requests.

## Review and logging

The Create Food manager has one Create food action. It opens the compact nested
`FoodCreateChoiceSheet.tsx` chooser titled “Create new”, with Food and Recipe
tiles styled like the AI method cards. There is no separate Create recipe
button on the manager. A choice opens the existing food or recipe editor after
the chooser dismisses; closing, Escape, dragging or a backdrop click returns to
the unchanged manager and restores focus to Create food. The chooser remains
compact even with the expanded-modals setting enabled, with its covered parent
inert and hidden from assistive technology. It uses the existing workspace guard.

Manual food creation and editing use `FoodEditor.tsx`. New foods start at
100 g. For grams and milliliters, enter the reference amount next to the unit
under “Nutrition per”. Decimal points and decimal commas are accepted. The
reference must be finite and positive, and all four nutrients must be finite
and non-negative. Piece, serving, weight ounce and US fluid ounce still use
nutrition for one portion with a conversion to grams or milliliters.
AI review offers the same
editor in a separate nested `FoodReviewEditorSheet` before confirmation. Its
edit/review action sits below the portion and nutrition preview, above the final
confirmation button. Editing keeps the selected consumption quantity in that preview.
Barcode-sourced product names, brands and nutrition
are read-only in scanner confirmation and the saved library; amount/serving
controls and favorites remain available. Both `isBarcode` and barcode provenance
identify these products, including older saved products. A manually created food
with an optional barcode remains editable. Missing scanned nutrition blocks logging;
the user can scan another product or create a separate food manually.
The scanner and AI preview show an icon-only Font Awesome favorite star beside
the name inside `food-preview-name`, without a visible button surface or label.
The star remains keyboard-operable and exposes its pressed state.
AI requires the existing
activation, terms, key and third-party consent; Gemini continues to receive
requests directly from the browser. No new external host or CSP change is used.
AI responses are validated as food or recipe estimates. Recipe candidates have
named ingredients with quantities and yield. Each ingredient must be matched
to an existing personal food (ambiguous or missing matches require a choice).
Calculated ingredient nutrition replaces the provider's estimated recipe totals.

Search shows saved catalog definitions indefinitely and history-only foods for
14 days (inclusive cutoff). Favorites is a separate, locally searchable subset
with no expiry. Stable catalog IDs take precedence. Legacy fallback requires
matching name, brand, barcode, basis, nutrition and portion metadata; a name
alone never groups foods. Ambiguous matches are left unlinked. Legacy rounded
snapshots may remain separate when their original per-100 basis cannot be
recovered exactly. Temporary history groups separately from catalog results,
even for an identical definition. Its latest occurrence sets the search result's
age. The diary entry remains after the search result expires.

Search results appear once under the local usage day of their most recent
associated log (`FoodEntry.date`): Today, Yesterday, then dates without times.
Saved definitions without matching usage in the existing 14-day window appear
under Saved. Favorites remains a separate list. Compact result cards truncate
names, nutrition/description and brand to one line with slightly smaller text;
neither list displays last-used timestamps. Add uses a 30px visual control within
a 44px touch target, without an avatar or pseudo-element border on the button.
A successful add briefly replaces its plus with a black checkmark on white;
repeated clicks still create independent selections. A visually hidden status
announces successful additions. Search/Favorites results enter with a subtle
140ms fade/translation; reduced motion disables the transition. The placeholder
is simply Search…. The synthetic AI Detection brand (ignoring case and outer
whitespace) is hidden in readable library views without changing stored values.
Sheet headers show Back on the left when navigation is available, otherwise
Close on the right, using the shared `back-btn` style and Font Awesome icons.
Back and Close are never displayed together. Escape, backdrop and drag dismissal
remain available with either header layout.
Each result has a plus button. Plus only persists a selection; removable,
single-line chips scroll horizontally below Search beside a fixed arrow button
labelled “Review selected foods”. An empty selection keeps a full-width, 40px
dashed row showing “No food selected.”, without a Review arrow.
`FoodSelectionChips.tsx` prepends the newest selection and scrolls it into view.
Web Animations move existing chips and introduce the newest chip from the left;
removal scales/fades the chip before persisting its removal. The final hidden
frame stays applied until React removes the node, avoiding a cancellation flash;
a failed selection write restores the chip. Review is disabled
while removals finish. Reduced motion applies the changes immediately.
Review shows foods in an internally scrolling review viewport, with independent
amount/unit controls, favorite, calculated nutrition tiles and Remove action.
Cards scroll internally when their controls exceed the available height. The
`.modal-footer.food-review-footer` is a flex sibling of the scrolling body and
keeps totals, the shared date/time and a checkmark-only “Log selected foods”
button visible without covering cards. Totals and date/time share the rounded
`food-batch-summary` panel with its own background above the completion button.
The summary uses two compact rows: calories on the left and icon-labelled
protein/carbs/fat on the right, followed by the date/time action below a divider.
All icons use Font Awesome; nutrient names remain available to screen readers.
`foodBatch.ts` builds occurrences with
the existing portion conversions and sums their rounded saved nutrition values.
Saved Foods and Create Food keep the maximum available sheet height across
Search, details, editing and Review; safe areas and visual-viewport changes
adjust that height, while content changes do not. Selecting
the same food twice intentionally creates two independent log entries.
Selection snapshots persist across sheet close/reload and stay in their owner
workspace. Candidate confirmation explicitly saves the food to the catalog;
unconfirmed AI drafts remain in the existing draft keys.

Search, Favorites and Custom Food all open `FoodDetailSheet.tsx`, the shared
`savedFoodDetail` sheet, when a food is selected. Custom Food rows expose
“View [name]” instead of opening editing directly. All three use the same
`FoodEditSheet.tsx` from its Edit action; barcode products can be viewed and
favorited but have no Edit action. No source-specific detail/editor is created.
The existing detail/edit markup, styles and classes are reused.
The parent list
DOM stays mounted, retaining search/tab, scroll, chips and unsaved state.
`food-library-modal--has-submodal` marks covered sheets; their overlay is inert
and aria-hidden and also gets the existing `has-sub-modal` shrink modifier.
This modifier is toggled independently so it cannot replace the sheet hook's
imperative `visible` class. Children use `food-library-nested-overlay` and the shared
Escape, backdrop, drag, focus trap, viewport and safe-area behavior. Closing
details restores focus to its opening result; closing editing restores its
Edit button. Only the top sheet handles Escape.
Food-library sheets animate both transform and scale for 350ms using
`cubic-bezier(0.4, 0, 0.2, 1)`, including their covered-parent scaling. The sheet
hook's optional additional transition properties preserve this during inline
opening, closing and height transitions. Compact choosers disable expansion;
other consumers retain the hook's existing expansion behavior. Reduced motion
removes the visual transition.
As with Settings and Licenses, a covered sheet starts restoring its scale when
its last visible child starts closing, rather than waiting for that child to
unmount. It remains inert until closing completes; deeper visible sheets keep
their underlying parents scaled down.

FoodEditor nutrition inputs display at most two decimal places, without trailing
zeroes. Entered values are rounded on blur. Untouched prefilled nutrients retain
their original calculation precision in previews and on save.

Food details show brand, basis, nutrition, portion amounts and recipe
ingredients where available; barcode text is hidden without changing its stored
value or editing field. The food avatar, single-line title and icon-only favorite
star share one centered row; long titles truncate with an ellipsis.
Stars persist favorites independently from food
definitions. Favoriting a history food saves an associated definition without
rewriting its original entry. Edit preserves the ID; confirmed Delete adds a
definition tombstone and never deletes log entries. An ingredient referenced by
an existing recipe cannot be deleted locally. A concurrent remote deletion can
leave a recipe needing repair; that recipe displays an error and cannot be
queued until repaired.

Existing-food editing opens `FoodEditSheet.tsx` above the shared detail sheet.
`FoodFavoriteButton.tsx` provides the Font Awesome star in both details and every
existing-food/recipe editor. It reads the same catalog ID and favorite register
across all three entry points. In editing, it acts on the saved food rather than
the mutable preview: favoriting never saves an unfinished name, nutrition or
recipe edit. Favorite changes are independent and remain applied after Cancel.
The main sheet and its active detail DOM stay mounted;
it is inert while covered. Cancel, Back, Close, Escape, drag dismissal or Save
return to the same view, quantity/unit, selection and scroll position, with
focus restored to the Edit button after the main sheet becomes interactive.
Save updates the catalog; the current detail/selection snapshots are retained,
and selecting the food again reads the updated definition. Creation uses the separate nested dialog described below.
AI correction and separate manual entry retain their existing editor flows;
barcode-sourced products do not offer editing.

Custom Food's Add to selection uses the same `foodBatch.ts` selection cache,
IDs and default portions as Search/Favorites. It prepends the chosen snapshot,
preserves other selections and their shared timestamp, and never logs a food
directly. A prepared batch awaiting retry blocks additions without replacing
its fixed IDs or cache. Search/Favorites read this selection when opened.

For a new manual food, “Temporary food” starts unchecked. With it checked,
“Save food” adds one chip and opens Search after the editor and manager dismiss.
It preserves existing chips and the shared timestamp. The first amount is the
entered reference for g/ml or one piece, serving or ounce. A pending batch
or failed selection write keeps the editor open with its draft. Removing the
chip before confirmation discards that selection. “Log selected foods” commits
temporary and regular selections in one local batch. Temporary selections
skip catalog saving, including when selected again from history. The favorite
action can explicitly save a definition to the library.

The date/time picker uses its content height by default. The existing expanded-
modals preference can still open it expanded, and its usual drag expansion remains
available; the other food-library sheets retain their full-height layout.

The review timestamp initializes to the local current minute when review is
first created and persists with the selection. `FoodDateTimeSheet.tsx` opens
above an inert review. Date, Hour and Minute are focusable spinbuttons with
selected-value text. Each vertical mouse-wheel event smoothly scrolls one row in
the Date, Hour or Minute column, including queued steps during rapid scrolling;
reduced motion applies the step immediately. Horizontal scrolling and Ctrl-wheel zoom are
not intercepted. Touch scrolling retains native scrolling and snapping.
Up/Down change one row; Page Up/Down change ten; Home/End
select the first/last hour or minute. The date wheel recycles a bounded 201-row
calendar window without changing the selected day. Hours/minutes wrap within
0–23/0–59, independently of the date. Scroll snapping and a fading selection
band also support touch. Done commits; every other dismissal discards drafts.
`foodDateTime.ts` converts calendar fields in local time; nonexistent times in
a daylight-saving gap require another time. Ambiguous fall-back times use the
browser Date constructor's earlier occurrence. All batch entries share one
millisecond `ts` and `date = new Date(ts).toDateString()`.

Details and the edit overlay share `NutritionFacts.tsx`: Fat, Carbs and Protein
columns beside a CSS conic-gradient calorie ring, a divider, preview Portion
size controls and recipe ingredient cards that expand to show ingredient
calories. The ring uses the history chart's nutrient color mapping and macro
energy shares (9 kcal/g fat, 4 kcal/g carbs/protein); its center always shows
the existing calculated food calories, which can differ from macro energy.
There are no daily-value or other percentage fields in the food model, so no
percentage labels are invented. Detail quantities update this layout and the
amount subsequently added to selection. Edit-preview quantities do not change the main
detail or queued amounts. `FoodEditor` and `RecipeEditor` supply validated
drafts/calculated recipes to the preview using their existing validation and
nutrition functions; the original editing controls and recipe semantics remain.
On non-iOS browsers the editor body has a thin scrollbar; the horizontal chip
strip also uses a slim scrollbar.

`FoodAvatar.tsx` renders an existing Font Awesome class or emoji and falls back
to the food's initial for older foods without an icon. Gemini's image/camera
and text prompts request an `icon` from the existing Free food-icon allowlist in
`foodIcons.ts`. The response schema requests that field; sanitization tolerates
older missing/invalid icons and keeps the existing category fallback. The icon
travels in the existing `FoodSearchResult.emoji` field through food/recipe
correction, catalog saving and log snapshots. No new storage key is introduced.

The Saved Foods browser coverage in `e2e/saved-foods.spec.ts` checks portrait
(390×844), short (320×480) and landscape (844×390) viewports, wheel scrolling
between review cards, internal access to Remove, independent quantities/units and
favorites, selection persistence, final batch logging and stable sheet height
through details/editing and viewport rotation. It also covers mounted/inert
parent state and focus return, exact footer totals/shared timestamps, long date
scrolls and cyclic time wheels, picker cancellation, both themes, animated and
reduced-motion chip removal, partial local failure/retry IDs and a controlled
delayed/failed cloud transport. External services are intercepted; these desktop
Edge checks do not establish physical touch-device or screen-reader behavior,
live Auth/MFA/RLS or production deployment state.

## Local format and compatibility

`foodLibrary.ts` owns `calsync_food_library_v1`:

```ts
{ version: 1, changes: LibraryChange[], pending: string[], imported: string[] }
```

Changes are immutable operations with unique IDs, catalog food IDs, a monotonic
logical millisecond time and either a definition (or null tombstone), or a
favorite boolean. Each definition/favorite register resolves by `(time, ID)`;
different foods and favorite-versus-definition edits merge independently.
Concurrent edits to the same definition resolve deterministically to one
version; all operations remain retained. This is not a collaborative field
editor: simultaneous edits of the same food are not combined field by field.
Device clock skew can influence which concurrent definition wins.

Legacy `calsync_custom_foods` and `calsync_favourites` are imported losslessly
without deleting their source keys or rewriting history. Custom IDs survive;
compatibility IDs for legacy favorites are deterministic. Legacy imports use
time zero so they cannot beat subsequent catalog edits/deletions. Import tokens
prevent old source records from resurrecting a deleted definition. A legacy
favorite expressed per 100 pieces uses a piece equivalent of one canonical
gram to preserve its previous calculation. New screens write the versioned
catalog instead of replacing `user_settings.custom_foods`. The old settings
column, migration and queue code remain for compatibility with existing data.
Older application versions must be retired during rollout: their later edits
to legacy arrays are not a supported concurrent editor for the new catalog.

`calsync_food_selection_v1` stores `{version: 1, items: [...], ts?, batch?}`.
Existing items-only caches remain readable. Optional `ts` is the confirmed
shared timestamp; `batch` retains prepared occurrences/IDs during commit/retry.
After preparation the sheet starts dismissing before the local commit runs.
`commitFoodEntries()` returns after local journal completion and exposes a
separate `cloudSync` promise; existing `logFoodEntries()`/`logFoodEntry()` callers
retain their awaited result contract. Cloud failure keeps the sheet closed and
logged entries pending; it never restores the selection. A local write failure
reopens review with its cache, time and fixed IDs. Prepared batches cannot be
edited until retried, preventing changed quantities from duplicating partial
writes. Closing still retains this retry state. Owner/generation guards apply
before committing and before any later UI/cache/sync feedback.

The final local
commit first writes `calsync_food_batch_v1`, containing owner and fixed entry
IDs. `recoverFoodBatch()` idempotently writes food, mirrored whole-ml hydration
and pending queues, then removes the journal. Interrupted storage writes can
finish after reload without duplicate log IDs. Single AI/barcode logging does
not discard an unrelated selection. Storage exhaustion reports a local error;
existing values and the journal remain available for retry.

All three new keys belong to `HEALTH_DATA_KEYS`, so account switching, explicit
local clearing and guest isolation use the established workspace snapshots.
Explicit guest import retains its existing tracked-entry-only behavior;
definitions/favorites/recipes are not silently copied into an account. Settings
JSON export includes the versioned library but never includes the Gemini key.

New `FoodEntry.catalogFoodId` is optional. `foodSnapshot` stores the definition's
nutrition basis, selected consumption amount and optional recursively calculated
recipe/ingredient snapshot. For manual g/ml definitions, optional
`nutritionBasisAmount` records the entered reference in the existing JSON.
Core nutrients are normalized per 100 with `nutritionPer100`. For example,
300 kcal per 150 g becomes 200 kcal per 100 g, and an 80 g occurrence logs
160 kcal. The editor reconstructs its displayed values from the reference
and keeps the stored per-100 values for unchanged nutrients at the same
reference. Older g/ml definitions open at 100. A saved consumption preference
takes priority over the reference when starting a new selection. Barcode and
recipe definitions keep their source and yield rules.
Temporary selections and logged snapshots carry `temporary: true`. The diary
entry has no catalog ID. Local recovery and cloud transport use the existing
selection, journal and food snapshot JSON.
Calories/macros on each occurrence remain authoritative for dashboard/history.
Dates still use `Date.toDateString()` and timestamps are milliseconds.

## Recipes

Each recipe is a stable catalog definition with optional brand/description,
up to 100 ingredients and a positive final yield in servings, grams or
milliliters. In the manual recipe editor, **Choose Food** opens a compact,
local catalog search and adds the chosen definition by `foodId`.
**Scan Barcode** opens the existing scanner even with an empty catalog.
**Add to recipe** adds an embedded `barcodeFood` snapshot to the draft
with the chosen amount and unit. The snapshot retains the product identity,
normalized nutrients and the conversion choices. This also applies when the
same product exists in the catalog. Saving the recipe writes one catalog
definition. Scanned ingredients do not create separate catalog definitions,
favorites, selection chips or diary entries.

Closing the picker or scanner returns to the mounted recipe form. Closing
the scanner without adding restores focus to **Choose Food**. Saving persists
the snapshot through the existing library operation JSON and cloud sync, so
viewing or editing the recipe requires no new product lookup. Canceling the
recipe discards uncommitted scans. Both ingredient types support amount/unit
edits and removal. Catalog references continue to resolve nested recipes and
protect referenced definitions from deletion. The resolver uses
`foodAmountToBase` for both types and rejects missing references, invalid
nutrients, unsupported conversions, cycles and excessive nesting. The editor
calculates recipe totals from the ingredients.

For a weight/volume yield, stored per-100 values use that declared yield. A
serving yield uses a 100-unit internal normalization for one serving and a
`serving` portion of 100. Only servings are offered for this yield, with no
invented gram equivalent; final log amounts/units are actual servings.
Logged snapshots capture the calculated tree, so later edits to ingredients
or yield do not change historical calories/macros.

## Cloud transport and rollout

`syncFoodLibrary()` in `sync.ts` runs through `AuthContext` after settings/reset
handling. It verifies `/api/sync/verify`, checks the workspace generation, inserts
pending operations in batches with `(user_id, operation_id)` and duplicate-ignore
semantics, and downloads all owner rows using exact-count pagination. Failures
throw; they never become successful empty libraries. Confirmed operation IDs
are acknowledged individually; a late response cannot clear newer edits.
Downloads union with current local operations rather than replacing a whole
array. Logical definition tombstones remain retained and block stale pulls.

Historical documentation describes an additive
`supabase/migrations/20261029010000_food_library.sql`. As inspected on
November 2, 2026, this checkout has no `supabase/` directory or that migration.
The following is the previously documented design, not executable rollout
evidence from this checkout. That design adds `catalog_food_id` and `food_snapshot` to `calsync_entries` and creates
`food_library_changes` with auth-user cascade and owner/MFA-gated SELECT/INSERT
RLS. Authenticated users have no UPDATE/DELETE permission on operations. A
narrow definer helper checks only the caller's verified TOTP factors. A trigger
clears the owner's library operations in the transaction that updates
`user_settings.data_reset_at`; pulls also exclude operations created before the
reset marker. No existing RLS policy is replaced.

Before rollout inspect target column types/grants, table/function/trigger name
collisions, auth MFA schema, reset RPC semantics and migration history. In an
isolated project test owner A/B isolation, no-factor AAL1, verified-factor AAL1
denial/AAL2 access, immutable duplicate insert, reset transaction and auth-user
cascade. Locate/reconcile the actual migration and target schema before any rollout;
old schemas retain local
writes but cannot sync new food-log columns/library operations. No live schema,
migration application or real Auth/RLS behavior is established by local tests.

Operation logs intentionally retain revisions and tombstones; no automatic
compaction is implemented. Browser quota is a practical limit. Any future
compaction must preserve deleted identities and multi-device reconciliation.


## Barcode amount contract (November 2, 2026)

`barcodeFood.ts` maps the **existing v0** lookup at
`https://world.openfoodfacts.org/api/v0/product/{code}.json`. It expects numeric
`status: 1` and a `product` object; it does not assume v3's response envelope or
a provider-supplied unit list. The legacy
[Display::display_product_api implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Display.pm)
returns stored/customized product fields. The
[v3 documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
was reviewed for comparison; no API migration was made. The live endpoint could
not be reached from this execution environment; response coverage uses mocked
v0 products and the official implementation, not a live availability claim.

Inspected fields: `quantity`, `product_quantity`, `product_quantity_unit`,
`serving_size`, `serving_quantity`, `serving_quantity_unit`, `nutrition_data_per`,
`nutrition_data_prepared_per`, and `nutriments`. Available amount/basis fields
are retained in `barcodeAmounts.raw`. Per-100 nutrient suffixes represent
normalized nutrition; raw nutrients are accepted only with a matching declared
basis. Prepared and as-sold macro fields are never mixed to fill gaps.
Incomplete core nutrition remains invalid for logging/favoriting. Names, brands
and source nutrition remain read-only.

The official [Units.pm implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Units.pm)
normalizes raw quantity/serving text to **g or ml**, including multipacks:
`2 kg` becomes `product_quantity: 2000, product_quantity_unit: g`. These derived
values are not converted again. Unexpected nonstandard structured units are
shown but their numeric values are not treated as already-normalized amounts.
Package mass/volume determines the per-100 basis; serving information is a
fallback. An otherwise unqualified `_100g` basis remains grams. Categories
such as beverages never establish density or override a mass basis.

The selector uses shared `foodPortions.ts` conversions in confirmation, details,
recipes and review. Equivalent-unit switching divides the canonical quantity
by the new factor, preserving consumption and nutrition. Standard choices are
g/kg/weight ounces for mass, or ml/L/US fluid ounces for volume. Returned
text/structured units additionally expose mg, micrograms, lb, cl, dl, cups,
metric cups, US customary cups, teaspoons, tablespoons, US pints/quarts/gallons,
explicit Imperial fluid ounces, pieces, named portions, servings, packages and
multipack units where present. Decimal commas and ordinary/mixed fractions are
parsed. Common English/French/German aliases, case and plurals deduplicate;
unrecognized numbered labels remain in source metadata under stable `off:` identifiers.
This is not a complete multilingual copy of the OFF taxonomy: unknown labels
are excluded from amount selectors unless a reliable conversion is known. Energy/nutrient
labels such as kcal/kJ/IU/% are excluded from consumption units.

The [OFF unit taxonomy](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/units.txt)
defines an unqualified cup as the **240 ml US legal nutrition cup**. The UI
labels this convention. Shared constants use 28.349523125 g per avoirdupois
ounce and 29.5735295625 ml per US fluid ounce; explicit Imperial fluid ounces
use 28.4130625 ml. Cups paired with a product amount use that relationship:
`1 cup (120 g)` supplies a product-specific density, which takes priority over
the explicitly labeled 1:1 ml estimate available for mass-based foods.
Pieces/named amounts require a count and known total in the same
serving or package, e.g. `2 pieces (30 g)` means 15 g/piece. A serving retains
its full source text. Multipack totals and per-pack amounts are separate choices.

If only directly declared per-serving nutrition is usable, 100 internal
calculation units represent one serving (as with serving-yield recipes);
the occurrence records actual servings, without an invented gram weight.
Choices without reliable factors are retained as source metadata but omitted
from amount selectors, apart from the explicitly requested mass-to-ml estimate.
If no usable portion remains, amount controls are
disabled and a bordered, padded notice explains how to enter a manual food.
Manual food creation can supply an explicit mapping; barcode
nutrition is never edited to make an unsupported choice appear valid.
Complex/unrecognized labels can therefore require a manual definition.

`FoodSearchResult.barcodeAmounts` stores the independent nutrition basis, display
basis label, raw fields and `{unit, label, baseAmount?, issue?}` choices.
`selectedAmount: {amount, unit}` retains consumption controls. Both travel in
existing catalog JSON and `FoodEntry.foodSnapshot`; no new key, column or
migration is required. Entry `amount/unit` remain canonical g/ml (or actual
servings for serving-only nutrition), so hydration mirroring still receives
whole ml. The snapshot retains selected cups, pieces, ounces etc. Details and
selection/review/reload read these values. Legacy food identities and entries
without metadata keep their previous interpretation.

## Creation and shared geometry

Custom Food keeps its list DOM and scrolling body mounted throughout creation.
The compact chooser closes completely, then mounts a distinct `FoodCreationSheet`
(`createFoodModal`) above the manager. It reuses FoodEditor/RecipeEditor, local
persistence and cloud retries. Save is latched once and closes through the shared
animation. Cancel, Back, Escape, backdrop and drag return to the manager.
The manager stays inert/aria-hidden through the chooser-to-editor transition;
chooser focus restoration is skipped when an editor will open. Closing the
editor restores the Create food opener and refreshes the manager list.

Shared viewport, scroll-lock, gesture ownership and sizing are documented in
[architecture.md](./architecture.md#modals-and-sheets). Barcode confirmation
is measured after committed step/content changes rather than retaining camera
height. Long content fills the visible maximum and scrolls above the footer.
Compact chooser/picker sizing and expanded-modals preferences stay
consumer-specific.

The extra-menu grid uses explicit equal border-box width/height derived from
available width **and** dynamic viewport height minus navigation/safe areas.
Its three-column rows scroll inside that fixed square when necessary. Icon
surfaces have fixed equal dimensions, no shrinking, centered glyphs and native
button padding reset. See [verification](./food-sheet-verification.md) for
measured coverage and remaining physical-iOS checks.

Shared sheet animation, modal stacking and the complete consumer inventory are documented in [shared-sheets.md](shared-sheets.md). FoodLibrarySheet keeps its food-specific markup while the shared hook owns entrance/exit, measurement, viewport, locks, focus and gestures. Internal search/review and food/recipe editor content changes do not replay entrance motion.

## Saved portions and duplicate products (November 3, 2026)

Saving/favoriting/logging a reviewed portion retains its positive amount and
supported unit in `selectedAmount`, including an explicit amount of 1. Saved
Foods and Custom Food labels show the chosen portion followed by its calculated
calories, e.g. `500ml • 10kcal`, and details/selection reopen with that amount.
Older snapshots without this preference can use a compatible logged amount.
Definition nutrition and past food logs retain their original precision.
Nutrition labels use at most three significant digits without zero padding;
this is display formatting, not a change to log rounding or source data.

Rescanning the same barcode/preparation reuses its saved food ID even if source
unit metadata or nutrition has changed. New identical manual definitions also
reuse an existing ID; different brands, nutrition, units and recipes stay
distinct. Existing duplicate rows collapse in discovery/management, preferring
usable barcode amount metadata. Their underlying IDs and historical snapshots
remain intact for recipe links and cloud operation history. Unfavoriting a
combined row clears matching favorite aliases, and explicit deletion checks
all aliases for recipe references before marking matching definitions deleted.
No database migration or new storage key is required.

### Optional ml estimate for mass-based foods

Mass-based g/kg foods also offer `ml (1:1 estimate)` in the shared amount
selectors. This is an explicit app assumption of 1 gram per milliliter, not a
universal physical equivalence. Known product density from a supported volume
choice, or a custom fluid-ounce weight, takes priority and displays plain `ml`.
Pieces and serving-only nutrition do not gain an invented physical weight.
Switching 0.5 kg to the estimated ml option gives 500 ml and preserves the
calculated nutrition. Stored entry quantities retain the original gram basis;
`selectedAmount` remembers ml for labels and future review. This option alone
does not classify a food as a drink or add hydration entries.
