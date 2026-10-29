'use client';

import { useEffect, useState, useRef } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import { useAuth } from '../../_context/AuthContext';
import { activeOwner, workspaceGuard } from '../../_lib/localData';
import { parseCustomFoods, readCustomFoods, saveCustomFoods } from '../../_lib/customFoods';
import { generateId } from '../../_lib/ids';
import { foodBasisLabel, GRAMS_PER_OUNCE, ML_PER_US_FL_OUNCE, nutritionPer100, type NutritionBasis } from '../../_lib/foodPortions';
import { foodNutrition } from '../../_lib/foodEntry';
import type { CustomFood } from '../../_lib/types';

const fields = [
    ['kcalPer100', 'Calories (kcal)'], ['protPer100', 'Protein (g)'],
    ['carbPer100', 'Carbohydrates (g)'], ['fatPer100', 'Fat (g)'],
] as const;
type Editor = { id: string; name: string; brand: string; defaultUnit: 'g' | 'ml'; basis: NutritionBasis; portionAmount: string;
    kcalPer100: string; protPer100: string; carbPer100: string; fatPer100: string };

export default function CustomFoodsModal({ onClose }: { onClose: () => void }) {
    const { user, retrySync, showToast } = useAuth();
    const [foods, setFoods] = useState(readCustomFoods);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [error, setError] = useState('');
    const [isCurrent] = useState(() => workspaceGuard());
    const [owner] = useState(activeOwner);
    const nameRef = useRef<HTMLInputElement>(null);
    const addRef = useRef<HTMLButtonElement>(null);
    const errorRef = useRef<HTMLParagraphElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const editorId = editor?.id;
    useEffect(() => {
        const refresh = () => { if (isCurrent()) setFoods(readCustomFoods()); };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, [isCurrent]);
    useEffect(() => {
        if (editorId) nameRef.current?.focus();
        else (returnFocus.current?.isConnected ? returnFocus.current : addRef.current)?.focus();
    }, [editorId]);
    useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

    const edit = (food?: CustomFood) => {
        returnFocus.current = document.activeElement as HTMLElement;
        setError('');
        let id = food?.id;
        if (!id) do { id = generateId('food'); } while (readCustomFoods().some(item => item.id === id));
        const factor = food?.portion ? food.portion.amount / 100 : 1;
        const value = (key: typeof fields[number][0]) => food ? String(Number((food[key] * factor).toPrecision(12))) : '';
        setEditor({ id, name: food?.name || '', brand: food?.brand || '', defaultUnit: food?.defaultUnit || 'g',
            basis: food?.portion?.unit || food?.defaultUnit || 'g', portionAmount: food?.portion ? String(food.portion.amount) : '',
            kcalPer100: value('kcalPer100'), protPer100: value('protPer100'),
            carbPer100: value('carbPer100'), fatPer100: value('fatPer100') });
    };
    const persist = (next: CustomFood[]) => {
        if (!isCurrent() || owner !== (user?.id || 'guest')) return false;
        try {
            const { queuePending } = saveCustomFoods(next, owner);
            setFoods(readCustomFoods());
            if (queuePending) showToast('Saved on this device; cloud sync will retry.');
            if (user) void retrySync();
            return true;
        } catch {
            setError('Could not save on this device. Your previous foods are still available.');
            return false;
        }
    };
    const save = () => {
        if (!editor) return;
        if (fields.some(([key]) => !editor[key].trim())) { setError('Enter all four nutrition values. Use 0 if needed.'); return; }
        const hasPortion = editor.basis !== 'g' && editor.basis !== 'ml';
        const portionAmount = hasPortion ? Number(editor.portionAmount) : 100;
        if (!Number.isFinite(portionAmount) || portionAmount <= 0) { setError('Enter a positive portion size in grams or milliliters.'); return; }
        let parsed: CustomFood[] | null;
        try {
            parsed = parseCustomFoods([{
                id: editor.id, name: editor.name, brand: editor.brand, defaultUnit: editor.defaultUnit,
                ...Object.fromEntries(fields.map(([key]) => [key, nutritionPer100(Number(editor[key]), portionAmount)])),
                ...(hasPortion ? { portion: { unit: editor.basis, amount: portionAmount } } : {}),
            }]);
        } catch { parsed = null; }
        if (!parsed) { setError('Enter a name and finite, non-negative nutrition values.'); return; }
        const latest = readCustomFoods();
        const next = latest.some(food => food.id === editor.id)
            ? latest.map(food => food.id === editor.id ? parsed[0] : food) : [...latest, parsed[0]];
        if (persist(next)) { setEditor(null); setError(''); }
    };
    return <FoodLibrarySheet id="customFoods" title="Create Food" onClose={onClose} closePosition="left">
        {editor ? <form className="food-library-form" onSubmit={event => { event.preventDefault(); save(); }}>
            <h3>{foods.some(food => food.id === editor.id) ? 'Edit food' : 'New food'}</h3>
            <label htmlFor="customFoodName">Name</label>
            <input ref={nameRef} id="customFoodName" className="form-input" maxLength={200} required
                value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} />
            <label htmlFor="customFoodBrand">Brand (optional)</label>
            <input id="customFoodBrand" className="form-input" maxLength={200}
                value={editor.brand} onChange={event => setEditor({ ...editor, brand: event.target.value })} />
            <label htmlFor="customFoodUnit">Nutrition per</label>
            <select id="customFoodUnit" className="form-input"
                onChange={event => {
                    const basis = event.target.value as NutritionBasis;
                    const defaultUnit = basis === 'ml' || basis === 'fl_oz' ? 'ml' : 'g';
                    const portionAmount = basis === 'oz' ? String(GRAMS_PER_OUNCE) : basis === 'fl_oz' ? String(ML_PER_US_FL_OUNCE) : '';
                    setEditor({ ...editor, basis, defaultUnit, portionAmount });
                }} value={editor.basis}>
                <option value="g">100 g</option><option value="ml">100 ml</option>
                <option value="pcs">1 piece</option><option value="serving">1 serving</option>
                <option value="oz">1 oz (weight)</option><option value="fl_oz">1 US fl oz</option>
            </select>
            {editor.basis !== 'g' && editor.basis !== 'ml' && <div className="food-portion-definition">
                <label htmlFor="customFoodPortionAmount">{editor.basis === 'pcs' ? 'One piece equals' : editor.basis === 'serving' ? 'One serving equals' : editor.basis === 'oz' ? 'One ounce equals' : 'One US fluid ounce equals'}</label>
                <div className="food-portion-inputs">
                    <input id="customFoodPortionAmount" className="form-input" type="number" inputMode="decimal" min="0.001" step="any" required
                        readOnly={editor.basis === 'oz' || (editor.basis === 'fl_oz' && editor.defaultUnit === 'ml')}
                        value={editor.portionAmount} onChange={event => setEditor({ ...editor, portionAmount: event.target.value })} />
                    <select className="form-input" aria-label="Portion size unit" value={editor.defaultUnit} disabled={editor.basis === 'oz'}
                        onChange={event => {
                            const defaultUnit = event.target.value as 'g' | 'ml';
                            setEditor({ ...editor, defaultUnit, portionAmount: editor.basis === 'fl_oz' ? defaultUnit === 'ml' ? String(ML_PER_US_FL_OUNCE) : '' : editor.portionAmount });
                        }}>
                        <option value="g">g</option><option value="ml">ml</option>
                    </select>
                </div>
                <p className="food-library-hint">{editor.basis === 'fl_oz' && editor.defaultUnit === 'g'
                    ? 'Enter the actual weight for this food. Volume and weight depend on density.'
                    : `Enter the nutrition below for one ${editor.basis === 'pcs' ? 'piece' : editor.basis === 'serving' ? 'serving' : editor.basis === 'oz' ? 'ounce' : 'US fluid ounce'}.`}</p>
            </div>}
            <div className="food-library-nutrients">{fields.map(([key, label]) => <label key={key}>
                {label}<input id={`customFood-${key}`} className="form-input" type="number" inputMode="decimal"
                    min={0} step="any" required value={editor[key]}
                    onChange={event => setEditor({ ...editor, [key]: event.target.value })} />
            </label>)}</div>
            {error && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}
            <div className="food-library-actions">
                <button type="button" className="option-btn" onClick={() => { setEditor(null); setError(''); }}>Cancel</button>
                <button type="submit" className="option-btn active">Save food</button>
            </div>
        </form> : <div className="custom-foods-manager">
            <button ref={addRef} type="button" className="add-workout custom-food-add" onClick={() => edit()}>
                <span className="add-wo-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg></span>
                <span className="add-wo-text">Create food</span>
            </button>
            <ul className="routine-list custom-food-list">
                {!foods.length && <li className="empty-state" role="status">No foods yet. Create one!</li>}
                {foods.map(food => <li className="routine-item" key={food.id}>
                    <div className="routine-main">
                        <button type="button" className="routine-info custom-food-edit" onClick={() => edit(food)} aria-label={`Edit ${food.name}`}>
                            <span className="routine-name">{food.name}</span>
                            <span className="routine-stats">{food.brand || 'Custom food'} · {foodNutrition(food, food.portion?.amount || 100).kcal} kcal / {foodBasisLabel(food)}</span>
                        </button>
                        <div className="routine-actions">
                            <button type="button" className="routine-menu-btn" aria-label={`Delete ${food.name}`} onClick={() => {
                                if (window.confirm(`Delete "${food.name}"? Logged entries will be kept.`))
                                    persist(readCustomFoods().filter(item => item.id !== food.id));
                            }}><i className="fa-regular fa-trash-can" aria-hidden="true" /></button>
                        </div>
                    </div>
                </li>)}
            </ul>
        </div>}
        {error && !editor && <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>}
    </FoodLibrarySheet>;
}
