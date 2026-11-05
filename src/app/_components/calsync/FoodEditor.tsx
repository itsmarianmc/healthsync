'use client';

import { useState, type ReactNode } from 'react';
import type { CustomFood, FoodSearchResult } from '../../_lib/types';
import { parseCustomFoods } from '../../_lib/customFoods';
import { generateId } from '../../_lib/ids';
import { GRAMS_PER_OUNCE, ML_PER_US_FL_OUNCE, nutritionPer100, type NutritionBasis } from '../../_lib/foodPortions';

const fields = [['kcalPer100', 'Calories (kcal)'], ['protPer100', 'Protein (g)'],
    ['carbPer100', 'Carbohydrates (g)'], ['fatPer100', 'Fat (g)']] as const;

const formatNutrition = (value: number) => String(Number(value.toFixed(2)));
const decimalAmount = (value: string) => {
    const input = value.trim();
    return /^[+-]?(?:\d+[.,]?\d*|[.,]\d+)(?:e[+-]?\d+)?$/i.test(input) ? Number(input.replace(',', '.')) : NaN;
};

export default function FoodEditor({ food, onSave, onCancel, renderPreview, allowTemporary = false }: {
    food?: FoodSearchResult & { id?: string }; onSave: (food: CustomFood, temporary: boolean) => string | void; onCancel: () => void;
    renderPreview?: (food: FoodSearchResult | null) => ReactNode;
    allowTemporary?: boolean;
}) {
    const [id] = useState(() => food?.id || food?.catalogFoodId || generateId('food'));
    const [name, setName] = useState(food?.name || '');
    const [brand, setBrand] = useState(food?.brand || '');
    const [barcode, setBarcode] = useState(food?.barcode || '');
    const [basis, setBasis] = useState<NutritionBasis>(food?.portion?.unit || (food?.defaultUnit === 'ml' ? 'ml' : 'g'));
    const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>(food?.defaultUnit === 'ml' ? 'ml' : 'g');
    const [size, setSize] = useState(String(food?.portion?.amount || ''));
    const [reference, setReference] = useState(String(food?.nutritionBasisAmount ?? 100));
    const [temporary, setTemporary] = useState(false);
    const originalBasisAmount = food?.portion?.amount ?? food?.nutritionBasisAmount ?? 100;
    const [initialValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key,
        food && Number.isFinite(food[key]) ? food[key] * (originalBasisAmount / 100) : null])));
    const [values, setValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key,
        initialValues[key] === null ? '' : formatNutrition(initialValues[key])])));
    const [edited, setEdited] = useState<Partial<Record<typeof fields[number][0], boolean>>>({});
    const [error, setError] = useState('');
    const hasPortion = basis !== 'g' && basis !== 'ml';
    const draft = (): CustomFood => {
        const basisAmount = hasPortion ? Number(size) : decimalAmount(reference);
        if (!Number.isFinite(basisAmount) || basisAmount <= 0) throw new Error();
        const portion = hasPortion ? { unit: basis, amount: basisAmount } : undefined;
        const nutritionBasisAmount = hasPortion ? undefined : basisAmount;
        const parsed = parseCustomFoods([{ id, name, brand, defaultUnit: baseUnit,
            ...Object.fromEntries(fields.map(([key]) => {
                const original = edited[key] ? null : initialValues[key];
                const value = original ?? decimalAmount(values[key]);
                return [key, food && original !== null && basisAmount === originalBasisAmount
                    ? food[key] : nutritionPer100(value, basisAmount)];
            })),
            portion, nutritionBasisAmount }]);
        if (!parsed) throw new Error();
        return { ...food, ...parsed[0], portion, nutritionBasisAmount,
            barcode: barcode.trim() || undefined, provenance: food?.provenance || 'manual' };
    };
    let preview: FoodSearchResult | null = null;
    if (renderPreview) { try { preview = draft(); } catch { /* Validate incomplete drafts on submit. */ } }
    return <form className="food-library-form" noValidate onSubmit={event => {
        event.preventDefault();
        let next: CustomFood;
        try {
            next = draft();
        } catch {
            setError('Enter a name, a positive finite nutrition amount, and all four finite nutrition values (zero or greater).');
            return;
        }
        try { setError(onSave(next, temporary) || ''); }
        catch { setError('Could not save this food on this device. Check browser storage and try again.'); }
    }}>
        {renderPreview ? renderPreview(preview) : <h3>{food ? 'Review / edit food' : 'New food'}</h3>}
        <label htmlFor="customFoodName">Name</label><input autoFocus={!renderPreview} id="customFoodName" className="form-input" required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
        <label htmlFor="customFoodBrand">Brand (optional)</label><input id="customFoodBrand" className="form-input" maxLength={200} value={brand} onChange={e => setBrand(e.target.value)} />
        <label htmlFor="customFoodBarcode">Barcode (optional)</label><input id="customFoodBarcode" className="form-input" maxLength={80} value={barcode} onChange={e => setBarcode(e.target.value)} />
        <label htmlFor="customFoodUnit">Nutrition per</label>
        <div className={hasPortion ? undefined : 'food-portion-inputs'}>
            {!hasPortion && <input id="customFoodBasisAmount" className="form-input" aria-label="Nutrition basis amount"
                type="text" inputMode="decimal" required value={reference} onChange={e => setReference(e.target.value)} />}
            <select id="customFoodUnit" className="form-input" value={basis} onChange={e => {
                const next = e.target.value as NutritionBasis;
                setBasis(next);
                setBaseUnit(next === 'ml' || next === 'fl_oz' ? 'ml' : 'g');
                setSize(next === 'oz' ? String(GRAMS_PER_OUNCE) : next === 'fl_oz' ? String(ML_PER_US_FL_OUNCE) : '');
            }}>
                <option value="g">g</option><option value="ml">ml</option><option value="pcs">1 piece</option>
                <option value="serving">1 serving</option><option value="oz">1 oz (weight)</option><option value="fl_oz">1 US fl oz</option>
            </select>
        </div>
        {hasPortion && <><label htmlFor="customFoodPortionAmount">One {basis === 'pcs' ? 'piece' : basis === 'serving' ? 'serving' : basis === 'oz' ? 'ounce' : 'US fluid ounce'} equals</label>
            <div className="food-portion-inputs"><input id="customFoodPortionAmount" className="form-input" type="number" min="0.000001" step="any" required value={size}
                readOnly={basis === 'oz' || (basis === 'fl_oz' && baseUnit === 'ml')} onChange={e => setSize(e.target.value)} />
                <select className="form-input" aria-label="Portion size unit" disabled={basis === 'oz'} value={baseUnit} onChange={e => {
                    setBaseUnit(e.target.value as 'g' | 'ml');
                    if (basis === 'fl_oz') setSize(e.target.value === 'ml' ? String(ML_PER_US_FL_OUNCE) : '');
                }}><option value="g">g</option><option value="ml">ml</option></select></div>
            <p className="food-library-hint">{basis === 'fl_oz' && baseUnit === 'g' ? 'Enter the actual weight for this food. Volume and weight depend on density.' : 'Enter nutrition for one portion.'}</p></>}
        <div className="food-library-nutrients">{fields.map(([key, label]) => <label key={key}>{label}<input className="form-input" type="number" required min={0} step="any" inputMode="decimal"
            value={values[key]} onChange={e => {
                setValues({ ...values, [key]: e.target.value }); setEdited({ ...edited, [key]: true });
            }} onBlur={() => {
                if (edited[key] && values[key].trim() && Number.isFinite(Number(values[key])) && Number(values[key]) >= 0)
                    setValues(current => ({ ...current, [key]: formatNutrition(Number(current[key])) }));
            }} /></label>)}</div>
        {allowTemporary && <label className="food-temporary-option">
            <input type="checkbox" checked={temporary} aria-labelledby="temporaryFoodLabel"
                aria-describedby="temporaryFoodHint" onChange={e => setTemporary(e.target.checked)} />
            <span>
                <span id="temporaryFoodLabel" className="food-temporary-title">Temporary food</span>
                <span id="temporaryFoodHint" className="food-library-hint">Track this food without adding it to your library.</span>
            </span>
        </label>}
        {error && <p role="alert">{error}</p>}
        <div className="food-library-actions"><button type="button" className="option-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="option-btn active">Save food</button></div>
    </form>;
}
