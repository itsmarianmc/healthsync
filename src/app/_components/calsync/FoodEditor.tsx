'use client';

import { useState, type ReactNode } from 'react';
import type { CustomFood, FoodSearchResult } from '../../_lib/types';
import { parseCustomFoods } from '../../_lib/customFoods';
import { generateId } from '../../_lib/ids';
import { GRAMS_PER_OUNCE, ML_PER_US_FL_OUNCE, nutritionPer100, type NutritionBasis } from '../../_lib/foodPortions';

const fields = [['kcalPer100', 'Calories (kcal)'], ['protPer100', 'Protein (g)'],
    ['carbPer100', 'Carbohydrates (g)'], ['fatPer100', 'Fat (g)']] as const;

const formatNutrition = (value: number) => String(Number(value.toFixed(2)));

export default function FoodEditor({ food, onSave, onCancel, renderPreview }: {
    food?: FoodSearchResult & { id?: string }; onSave: (food: CustomFood) => void; onCancel: () => void;
    renderPreview?: (food: FoodSearchResult | null) => ReactNode;
}) {
    const [id] = useState(() => food?.id || food?.catalogFoodId || generateId('food'));
    const [name, setName] = useState(food?.name || '');
    const [brand, setBrand] = useState(food?.brand || '');
    const [barcode, setBarcode] = useState(food?.barcode || '');
    const [basis, setBasis] = useState<NutritionBasis>(food?.portion?.unit || (food?.defaultUnit === 'ml' ? 'ml' : 'g'));
    const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>(food?.defaultUnit === 'ml' ? 'ml' : 'g');
    const [size, setSize] = useState(String(food?.portion?.amount || ''));
    const [initialValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key,
        food && Number.isFinite(food[key]) ? food[key] * ((food.portion?.amount || 100) / 100) : null])));
    const [values, setValues] = useState(() => Object.fromEntries(fields.map(([key]) => [key,
        initialValues[key] === null ? '' : formatNutrition(initialValues[key])])));
    const [edited, setEdited] = useState<Partial<Record<typeof fields[number][0], boolean>>>({});
    const [error, setError] = useState('');
    const hasPortion = basis !== 'g' && basis !== 'ml';
    const draft = (): CustomFood => {
        if (fields.some(([key]) => !values[key].trim())) throw new Error();
        const parsed = parseCustomFoods([{ id, name, brand, defaultUnit: baseUnit,
            ...Object.fromEntries(fields.map(([key]) => [key, nutritionPer100(
                !edited[key] && initialValues[key] !== null ? initialValues[key] : Number(values[key]),
                hasPortion ? Number(size) : 100,
            )])),
            ...(hasPortion ? { portion: { unit: basis, amount: Number(size) } } : {}) }]);
        if (!parsed) throw new Error();
        return { ...food, ...parsed[0], barcode: barcode.trim() || undefined, provenance: food?.provenance || 'manual' };
    };
    let preview: FoodSearchResult | null = null;
    if (renderPreview) { try { preview = draft(); } catch { /* Validate incomplete drafts on submit. */ } }
    return <form className="food-library-form" onSubmit={event => {
        event.preventDefault();
        try {
            onSave(draft());
        } catch { setError('Enter a name, all four finite non-negative nutrition values, and a positive portion size.'); }
    }}>
        {renderPreview ? renderPreview(preview) : <h3>{food ? 'Review / edit food' : 'New food'}</h3>}
        <label htmlFor="customFoodName">Name</label><input autoFocus={!renderPreview} id="customFoodName" className="form-input" required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
        <label htmlFor="customFoodBrand">Brand (optional)</label><input id="customFoodBrand" className="form-input" maxLength={200} value={brand} onChange={e => setBrand(e.target.value)} />
        <label htmlFor="customFoodBarcode">Barcode (optional)</label><input id="customFoodBarcode" className="form-input" maxLength={80} value={barcode} onChange={e => setBarcode(e.target.value)} />
        <label htmlFor="customFoodUnit">Nutrition per</label>
        <select id="customFoodUnit" className="form-input" value={basis} onChange={e => {
            const next = e.target.value as NutritionBasis;
            setBasis(next); setBaseUnit(next === 'ml' || next === 'fl_oz' ? 'ml' : 'g');
            setSize(next === 'oz' ? String(GRAMS_PER_OUNCE) : next === 'fl_oz' ? String(ML_PER_US_FL_OUNCE) : '');
        }}><option value="g">100 g</option><option value="ml">100 ml</option><option value="pcs">1 piece</option>
            <option value="serving">1 serving</option><option value="oz">1 oz (weight)</option><option value="fl_oz">1 US fl oz</option></select>
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
                if (values[key].trim() && Number.isFinite(Number(values[key])))
                    setValues(current => ({ ...current, [key]: formatNutrition(Number(current[key])) }));
            }} /></label>)}</div>
        {error && <p role="alert">{error}</p>}
        <div className="food-library-actions"><button type="button" className="option-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="option-btn active">Save food</button></div>
    </form>;
}
