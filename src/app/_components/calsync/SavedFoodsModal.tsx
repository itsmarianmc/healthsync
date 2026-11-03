'use client';

import { useEffect, useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodDetailSheet from './FoodDetailSheet';
import FoodDateTimeSheet from './FoodDateTimeSheet';
import FoodSelectionChips from './FoodSelectionChips';
import FoodAvatar from './FoodAvatar';
import { libraryBrand, libraryPortionLabel, usageDayGroups } from './foodLibraryPresentation';
import { useAuth } from '../../_context/AuthContext';
import { workspaceGuard } from '../../_lib/localData';
import { ensureLibraryFood, isFoodFavorite, searchLibrary, setFoodFavorite, type LibraryItem } from '../../_lib/foodLibrary';
import { foodNutrition } from '../../_lib/foodEntry';
import { commitFoodEntries } from '../../_lib/foodLog';
import { batchNutrition, selectionEntry, createFoodSelection as selection, readFoodSelection as loadSelection, FOOD_SELECTION_KEY as SELECTION_KEY, type FoodSelection as Selection, type FoodSelectionCache as CachedSelection } from '../../_lib/foodBatch';
import { batchTimeLabel } from '../../_lib/foodDateTime';
import { foodAmountToBase, foodAmountUnits, foodUnitLabel, foodUnitOptionLabel, foodConversionIssue, type FoodAmountUnit } from '../../_lib/foodPortions';
import type { FoodEntry, FoodSearchResult } from '../../_lib/types';

function entries(): FoodEntry[] { try { return JSON.parse(localStorage.getItem('calsync_v1') || '[]'); } catch { return []; } }

export default function SavedFoodsModal({ onClose, initialView = 'search' }: {
    onClose: () => void; initialView?: 'search' | 'favorites';
}) {
    const { user, showToast, retrySync } = useAuth();
    const [view, setView] = useState(initialView);
    const [query, setQuery] = useState('');
    const [cached] = useState(loadSelection);
    const [queue, setQueue] = useState(cached.items);
    const [timestamp, setTimestamp] = useState<number | null>(cached.ts ?? null);
    const [selected, setSelected] = useState<LibraryItem | null>(null);
    const [review, setReview] = useState(!!cached.batch?.length);
    const [detailOpener, setDetailOpener] = useState<HTMLElement | null>(null);
    const [pickingTime, setPickingTime] = useState(false);
    const [removingChips, setRemovingChips] = useState(false);
    const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);
    const [selectionFeedback, setSelectionFeedback] = useState('');
    const addTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const [timeOpener, setTimeOpener] = useState<HTMLElement | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [dismiss, setDismiss] = useState(false);
    const [sheetKey, setSheetKey] = useState(0);
    const [revision, refresh] = useState(0);
    const [isCurrent] = useState(() => workspaceGuard());
    const logging = useRef(false);
    const [batch, setBatch] = useState<FoodEntry[] | null>(cached.batch ?? null);
    const localFailure = useRef(false);
    const entryFor = (item: Selection) => selectionEntry(item, timestamp ?? 0);
    useEffect(() => {
        const timers = addTimers.current;
        return () => timers.forEach(timer => clearTimeout(timer));
    }, []);
    useEffect(() => {
        const update = () => { if (isCurrent()) refresh(n => n + 1); };
        window.addEventListener('storage', update);
        const timer = window.setInterval(update, 30000);
        return () => { window.removeEventListener('storage', update); window.clearInterval(timer); };
    }, [isCurrent]);
    const persist = (next: Selection[], ts = timestamp) => {
        if (!isCurrent() || batch) return false;
        try {
            localStorage.setItem(SELECTION_KEY, JSON.stringify({ version: 1, items: next, ts }));
            setQueue(next); setBatch(null); setError('');
            setTimestamp(ts); return true;
        } catch { setError('Could not save the selection. Free some browser storage and retry.'); return false; }
    };
    let results: LibraryItem[] = [], unavailable = false;
    try { results = searchLibrary(entries(), query, view === 'favorites'); } catch { unavailable = true; }
    const groups = view === 'favorites' ? [{ key: 'favorites', label: '', items: results }] : usageDayGroups(results);
    const openDetail = (item: LibraryItem, opener: HTMLElement) => { setDetailOpener(opener); setSelected(item); setError(''); };
    const addFood = (item: LibraryItem) => {
        if (!persist([selection(item.food), ...queue])) return;
        setSelectionFeedback(`${item.food.name} added to selection.`);
        setRecentlyAdded(current => [...current.filter(id => id !== item.id), item.id]);
        clearTimeout(addTimers.current.get(item.id));
        addTimers.current.set(item.id, setTimeout(() => {
            setRecentlyAdded(current => current.filter(id => id !== item.id));
            addTimers.current.delete(item.id);
        }, 900));
    };
    const star = (food: FoodSearchResult) => {
        if (!isCurrent()) return;
        try {
            setFoodFavorite(food, !isFoodFavorite(food));
            refresh(revision + 1); void retrySync();
        } catch { setError('Could not update favorites on this device.'); }
    };
    const save = () => {
        if (!queue.length || logging.current || !isCurrent()) return;
        logging.current = true; setSaving(true); setError('');
        try {
            // Validate the whole selection before any library writes.
            queue.forEach(entryFor);
            const pendingBatch = batch || queue.map(item => entryFor({ ...item, food: ensureLibraryFood({ ...item.food, selectedAmount: { amount: Number(item.amount), unit: item.unit } }) }));
            const snapshot: CachedSelection = { version: 1, items: queue, ts: timestamp ?? pendingBatch[0].ts, batch: pendingBatch };
            localStorage.setItem(SELECTION_KEY, JSON.stringify(snapshot));
            setBatch(pendingBatch);
            localFailure.current = false;
            setDismiss(true);
            // Yield so dismissal starts before synchronous writes; the sheet stays mounted through exit.
            window.setTimeout(() => {
                if (!isCurrent()) return;
                try {
                    const { cloudSync } = commitFoodEntries(pendingBatch, user?.id);
                    showToast(`${queue.length} foods logged`);
                    void cloudSync.then(result => {
                        if (!isCurrent()) return;
                        if (result.cloudPending) showToast('Foods saved locally; cloud sync will retry.');
                        void retrySync();
                    });
                } catch {
                    if (!isCurrent()) return;
                    localFailure.current = true;
                    // Restore retry data after cleanup; journal IDs prevent duplicate partial writes.
                    try { localStorage.setItem(SELECTION_KEY, JSON.stringify(snapshot)); } catch { /* Original cache/journal remains. */ }
                    setError('Could not save on this device. Free some storage and retry.');
                }
            }, 0);
        } catch {
            logging.current = false; setSaving(false);
            if (isCurrent()) setError('Could not prepare these foods. Check amounts and device storage, then retry.');
        }
    };
    const amountFields = (item: Selection, change: (next: Selection) => void) => {
        let nutrition: ReturnType<typeof foodNutrition> | null = null;
        let base: ReturnType<typeof foodAmountToBase> | null = null;
        try { nutrition = entryFor(item); base = foodAmountToBase(item.food, Number(item.amount), item.unit); } catch {}
        const controls = <><div className="saved-food-amount-row"><label>Amount ({foodUnitLabel(item.food, item.unit)})<input className="form-input" disabled={saving || !!batch} type="number" inputMode="decimal" min="0.000001" step="any" required value={item.amount} onChange={e => change({ ...item, amount: e.target.value })} /></label>
            <label>Amount unit<select disabled={saving || !!batch} aria-label="Amount unit" className="form-input" value={item.unit} onChange={e => {
                const unit = e.target.value as FoodAmountUnit;
                let amount = item.amount;
                try { amount = String(foodAmountToBase(item.food, Number(item.amount), item.unit).amount / foodAmountToBase(item.food, 1, unit).amount); } catch {}
                change({ ...item, amount, unit });
            }}>{foodAmountUnits(item.food).map(unit => <option key={unit} value={unit}>{foodUnitOptionLabel(item.food, unit)}</option>)}</select></label></div>
            {base && base.unit !== item.unit && item.food.recipeSnapshot?.recipe.yield.unit !== 'serving' && item.food.barcodeAmounts?.basis !== 'serving' && <p className="food-library-hint">{Number(base.amount.toFixed(6))} {base.unit} total</p>}</>;
        return <>{controls}{foodConversionIssue(item.food, item.unit) && <p className="food-portion-notice" role="status">{foodConversionIssue(item.food, item.unit)}</p>}{nutrition ? <div className="saved-food-macros"><div className="saved-food-macro calories"><span>Calories</span><strong>{nutrition.kcal} kcal</strong></div>
            <div className="saved-food-macro"><span>Protein</span><strong>{nutrition.prot} g</strong></div><div className="saved-food-macro"><span>Carbs</span><strong>{nutrition.carb} g</strong></div><div className="saved-food-macro"><span>Fat</span><strong>{nutrition.fat} g</strong></div></div> : <p role="status">Enter a valid amount and unit to calculate nutrition.</p>}</>;
    };
    const goBack = () => { setSelected(null); setReview(false); setError(''); };
    const closeDetail = () => { setSelected(null); setError(''); };
    const openReview = () => {
        const ts = timestamp ?? Math.floor(Date.now() / 60000) * 60000;
        if (batch || persist(queue, ts)) { setTimestamp(ts); setReview(true); }
    };
    let totals: ReturnType<typeof batchNutrition> | null = null;
    try { totals = batchNutrition(batch || queue.map(entryFor)); } catch { /* Invalid amounts disable completion. */ }
    return <><FoodLibrarySheet key={sheetKey} id="savedFoods" title={review ? 'Review Foods' : 'Saved Foods'} onClose={() => {
        if (localFailure.current && isCurrent()) {
            localFailure.current = false;
            setDismiss(false); setSheetKey(key => key + 1); setReview(true); setSaving(false); logging.current = false;
        } else onClose();
    }} dismiss={dismiss} covered={!!selected || pickingTime} returnFocusTo={selected ? undefined : pickingTime ? undefined : detailOpener || timeOpener} bodyClassName={review ? 'food-review-body' : undefined}
        onBack={review ? goBack : undefined} backLabel="Back to saved foods" backDisabled={saving || !!batch}
        footer={review ? <div className="modal-footer food-review-footer">
            <div className="food-batch-summary">
                <dl className="food-batch-totals" aria-label="Batch nutrition totals">
                    <div className="food-batch-calories"><dt className="sr-only">Calories</dt><dd><i className="fa-solid fa-apple-whole" aria-hidden="true" />{totals?.kcal ?? '—'} kcal</dd></div>
                    <div className="food-batch-protein"><dt className="sr-only">Protein</dt><dd><i className="fa-solid fa-fish" aria-hidden="true" />{totals?.prot ?? '—'} g</dd></div>
                    <div className="food-batch-carbs"><dt className="sr-only">Carbs</dt><dd><i className="fa-solid fa-wheat-awn" aria-hidden="true" />{totals?.carb ?? '—'} g</dd></div>
                    <div className="food-batch-fat"><dt className="sr-only">Fat</dt><dd><i className="fa-solid fa-drumstick-bite" aria-hidden="true" />{totals?.fat ?? '—'} g</dd></div>
                </dl>
                <button type="button" className="food-batch-date" disabled={saving || !!batch} onClick={event => { setTimeOpener(event.currentTarget); setDetailOpener(null); setPickingTime(true); }}>
                    <i className="fa-solid fa-calendar-days" aria-hidden="true" /><span>Date</span><time dateTime={new Date(timestamp ?? 0).toISOString()}>{batchTimeLabel(timestamp ?? 0)}</time><i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
            </div>
            <button type="button" className="saved-food-log food-batch-complete" aria-label="Log selected foods" disabled={saving || !queue.length || !totals} aria-busy={saving} onClick={save}><i className={saving ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-check'} aria-hidden="true" /></button>
        </div> : undefined}>
        {unavailable && <p role="alert">The saved library could not be read. Existing storage has been preserved.</p>}
        {review ? <form className="food-library-form food-review-form" onSubmit={e => { e.preventDefault(); void save(); }}>
            <div className="food-review-viewport" role="region" aria-label="Selected foods to review" tabIndex={0}>
            {queue.map((item, index) => <section key={item.id} className="food-review-page" aria-label={`${item.food.name}, ${index + 1} of ${queue.length}`}>
                <div className="saved-food-card food-review-card">
                <div className="food-review-heading"><div><span className="food-review-position">{index + 1} / {queue.length}</span><h4>{item.food.name}</h4></div>
                <button type="button" className="option-btn food-review-favorite" aria-label={`Favorite ${item.food.name}`} aria-pressed={isFoodFavorite(item.food)} onClick={() => star({ ...item.food, selectedAmount: { amount: Number(item.amount), unit: item.unit } })}><i className={isFoodFavorite(item.food) ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" /></button></div>
                {amountFields(item, next => persist(queue.map(saved => saved.id === item.id ? next : saved)))}
                <button type="button" disabled={saving || !!batch} className="option-btn food-review-remove" aria-label={`Remove ${item.food.name}`} onClick={() => persist(queue.filter(saved => saved.id !== item.id))}><i className="fa-solid fa-minus" aria-hidden="true" /> Remove</button>
                </div>
            </section>)}
            {!queue.length && <p role="status">No foods selected.</p>}
            </div>
        </form> : <>
            <div className="food-library-tabs" role="group" aria-label="Food library view"><button type="button" className={`option-btn${view === 'search' ? ' active' : ''}`} aria-pressed={view === 'search'} onClick={() => { setView('search'); setQuery(''); }}>Search</button>
                <button type="button" className={`option-btn${view === 'favorites' ? ' active' : ''}`} aria-pressed={view === 'favorites'} onClick={() => { setView('favorites'); setQuery(''); }}>Favorites</button></div>
            <div className="food-library-search">
                <label htmlFor="savedFoodsSearch" className="sr-only">Search foods</label>
                <div className="food-library-search-field">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                    <input autoFocus id="savedFoodsSearch" className="form-input" type="search" value={query} placeholder="Search…" onChange={e => setQuery(e.target.value)} />
                </div>
            </div>
            <div className={`food-selection-row${queue.length ? '' : ' food-selection-row--empty'}`}>
            {queue.length ? <>
            <FoodSelectionChips items={queue} onRemove={id => persist(queue.filter(saved => saved.id !== id))} onRemovingChange={setRemovingChips} />
            <button type="button" className="food-library-review" aria-label="Review selected foods" disabled={removingChips} onClick={openReview}><i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
            </> : <span>No food selected.</span>}
            </div>
            <span className="food-library-feedback" role="status">{selectionFeedback}</span>
            <div key={view} className="food-library-results">
            {!results.length && <div className="food-library-empty" role="status">
                <i className={view === 'favorites' ? 'fa-solid fa-star' : 'fa-solid fa-magnifying-glass'} aria-hidden="true" />
                <p>{query ? 'No matching foods.' : view === 'favorites' ? 'No favorites yet.' : 'No saved foods yet.'}</p>
            </div>}
            {groups.map(group => <section key={group.key} className="food-library-group" aria-label={group.label || 'Favorites'}>
            {group.label && <h3 className="food-library-day">{group.label}</h3>}
            <ul className="food-library-list">{group.items.map(item => <li key={item.id} className="food-library-row">
                <button type="button" className="food-library-result" onClick={event => openDetail(item, event.currentTarget)}>
                    <FoodAvatar food={item.food} />
                        <span className="food-library-result-copy">
                            <span className="food-library-name">
                                <strong>{item.food.name}</strong>
                                {item.favorite && (
                                    <i className="fa-solid fa-star food-library-star" aria-hidden="true" />
                                )}
                            </span>
                            {libraryBrand(item.food.brand) && (
                                <span className="food-library-brand">{libraryBrand(item.food.brand)}</span>
                            )}
                            <span className="food-library-nutrition">
                                {item.error ? (
                                    'Needs repair'
                                ) : (
                                    <>
                                        {libraryPortionLabel(item.food)}
                                    </>
                                )}
                            </span>
                        </span>
                    </button>
                <button type="button" className={`food-library-add${recentlyAdded.includes(item.id) ? ' food-library-add--added' : ''}`} aria-label={`Add ${item.food.name} to selection`} disabled={!!item.error} onClick={() => addFood(item)}>
                    <span className="food-library-add-symbol"><i className={recentlyAdded.includes(item.id) ? 'fa-solid fa-check' : 'fa-solid fa-plus'} aria-hidden="true" /></span>
                </button>
            </li>)}</ul></section>)}
            </div>
        </>}
        {error && <p role="alert">{error}</p>}
    </FoodLibrarySheet>
    {selected && <FoodDetailSheet item={selected} onClose={closeDetail} onAdd={item => persist([item, ...queue])} />}
    {pickingTime && <FoodDateTimeSheet ts={timestamp ?? 0} onClose={() => setPickingTime(false)} onDone={ts => persist(queue, ts)} />}
    </>;
}
