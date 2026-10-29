'use client';

import { useEffect, useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import { useAuth } from '../../_context/AuthContext';
import { workspaceGuard } from '../../_lib/localData';
import { readCustomFoods, readFavourites, searchSavedFoods, type SavedFood } from '../../_lib/customFoods';
import { buildFoodEntry, foodNutrition } from '../../_lib/foodEntry';
import { foodAmountToBase, foodAmountUnits, foodBasisLabel, foodBaseUnit, FOOD_UNIT_LABELS, formatFoodAmount, type FoodAmountUnit } from '../../_lib/foodPortions';
import type { FoodEntry } from '../../_lib/types';

export default function SavedFoodsModal({ onClose, onLog }: {
    onClose: () => void; onLog: (entry: FoodEntry) => Promise<void>;
}) {
    const { showToast } = useAuth();
    const [library, setLibrary] = useState(() => ({ custom: readCustomFoods(), favourites: readFavourites() }));
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<SavedFood | null>(null);
    const [amount, setAmount] = useState('100');
    const [unit, setUnit] = useState<FoodAmountUnit>('g');
    const [saving, setSaving] = useState(false);
    const [logged, setLogged] = useState(false);
    const savingRef = useRef(false);
    const [isCurrent] = useState(() => workspaceGuard());
    const searchRef = useRef<HTMLInputElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const refresh = () => {
            if (isCurrent()) setLibrary({ custom: readCustomFoods(), favourites: readFavourites() });
        };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, [isCurrent]);
    useEffect(() => {
        if (selected) amountRef.current?.focus(); else searchRef.current?.focus();
    }, [selected]);
    const all = searchSavedFoods(library.custom, library.favourites, '');
    const results = searchSavedFoods(library.custom, library.favourites, query);
    const quantity = Number(amount);
    let base: ReturnType<typeof foodAmountToBase> | null = null;
    if (selected && amount.trim() && Number.isFinite(quantity) && quantity > 0 && quantity <= 9999) {
        try { base = foodAmountToBase(selected.food, quantity, unit); } catch { /* Invalid quantities stay unsaved. */ }
    }
    const computed = selected && base ? foodNutrition(selected.food, base.amount) : null;
    const nutrition = computed && Object.values(computed).every(value => Number.isFinite(value) && value >= 0) ? computed : null;
    const validAmount = !!base && !!nutrition;
    const selectFood = (result: SavedFood) => {
        setSelected(result);
        setUnit(result.food.portion?.unit || (result.food.defaultUnit === 'pcs' ? 'pcs' : foodBaseUnit(result.food)));
        setAmount(result.food.portion ? '1' : '100');
    };
    const changeUnit = (next: FoodAmountUnit) => {
        if (!selected) return;
        if (base) {
            const nextAmount = base.amount / foodAmountToBase(selected.food, 1, next).amount;
            setAmount(formatFoodAmount(nextAmount, 10));
        }
        setUnit(next);
    };
    const log = async () => {
        if (!selected || !base || !validAmount || savingRef.current || logged || !isCurrent()) return;
        savingRef.current = true;
        setSaving(true);
        try {
            await onLog(buildFoodEntry(selected.food, base.amount, base.unit));
            if (isCurrent()) setLogged(true);
        } catch {
            if (isCurrent()) showToast('Could not save food locally. Please try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    return <FoodLibrarySheet id="savedFoods" title="Saved Foods" onClose={onClose} dismiss={logged}
        onBack={selected && !logged ? () => setSelected(null) : undefined} backLabel="Back to saved foods" backDisabled={saving}>
        {logged ? <p role="status">Food logged. You can close this sheet.</p> : selected ? <form className="food-library-form saved-food-detail"
            onSubmit={event => { event.preventDefault(); void log(); }}>
            <section className="saved-food-card" aria-label="Selected food">
                <div className="saved-food-heading">
                    <span className="saved-food-avatar" aria-hidden="true">{selected.food.name.charAt(0).toLocaleUpperCase()}</span>
                    <div><h3>{selected.food.name}</h3>{selected.food.brand && <p>{selected.food.brand}</p>}</div>
                </div>
                <p className="food-library-hint">Nutrition per {foodBasisLabel(selected.food)}</p>
            </section>
            <section className="saved-food-amount">
                <label htmlFor="savedFoodAmount">Amount ({FOOD_UNIT_LABELS[unit]})</label>
                <div className="saved-food-amount-row">
                    <input ref={amountRef} id="savedFoodAmount" className="form-input" type="number" inputMode="decimal"
                        min="0.000001" max={9999} step="any" required value={amount} onChange={event => setAmount(event.target.value)} />
                    <select id="savedFoodUnit" className="form-input" aria-label="Amount unit" value={unit}
                        onChange={event => changeUnit(event.target.value as FoodAmountUnit)}>
                        {foodAmountUnits(selected.food).map(value => <option key={value} value={value}>{FOOD_UNIT_LABELS[value]}</option>)}
                    </select>
                </div>
                <div className="saved-food-quick-amounts" aria-label="Quick amounts">
                    {(unit === 'g' || unit === 'ml' ? [50, 100, 150, 250] : [0.5, 1, 2, 3]).map(value =>
                        <button type="button" key={value} className={`quick-btn${quantity === value ? ' active' : ''}`}
                            onClick={() => setAmount(String(value))}>{value} {FOOD_UNIT_LABELS[unit]}</button>)}
                </div>
                {base && unit !== base.unit && <p className="food-library-hint">{formatFoodAmount(base.amount)} {base.unit} total</p>}
            </section>
            {nutrition && <div className="saved-food-macros" aria-live="polite">
                {([['Calories', nutrition.kcal, 'kcal'], ['Protein', nutrition.prot, 'g'],
                    ['Carbs', nutrition.carb, 'g'], ['Fat', nutrition.fat, 'g']] as const).map(([label, value, suffix]) =>
                    <div className={`saved-food-macro${label === 'Calories' ? ' calories' : ''}`} key={label}>
                        <span>{label}</span><strong>{value}<small> {suffix}</small></strong>
                    </div>)}
            </div>}
            <button type="submit" className="saved-food-log" disabled={saving || !validAmount}>
                {saving ? 'Saving…' : 'Log food'}
            </button>
        </form> : <>
            <label htmlFor="savedFoodsSearch">Search name or brand</label>
            <input ref={searchRef} id="savedFoodsSearch" className="form-input" type="search" autoComplete="off"
                placeholder="Search saved foods…" value={query} onChange={event => setQuery(event.target.value)} />
            {!all.length ? <p role="status">No saved foods yet. Use Create Food or save a favourite in CalSync.</p> :
                !results.length ? <p role="status">No matching foods. Try another name or brand.</p> :
                <ul className="food-library-list">{results.map(result => <li key={result.key}>
                    <button type="button" className="food-library-result" onClick={() => selectFood(result)}>
                        <strong>{result.food.name}</strong>
                        <span>{result.food.brand || (result.source === 'custom' ? 'Custom food' : 'Favourite')} · {foodNutrition(result.food, result.food.portion?.amount || 100).kcal} kcal / {foodBasisLabel(result.food)}</span>
                        <small>{result.source === 'custom' ? 'Custom food' : 'Favourite'}</small>
                    </button>
                </li>)}</ul>}
        </>}
    </FoodLibrarySheet>;
}
