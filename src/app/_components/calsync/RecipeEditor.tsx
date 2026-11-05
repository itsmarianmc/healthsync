'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import BarcodeSearchPopup from './BarcodeSearchPopup';
import FoodLibrarySheet from './FoodLibrarySheet';
import { libraryBrand } from './foodLibraryPresentation';
import { generateId } from '../../_lib/ids';
import { libraryData, resolveFood, searchLibrary, NUTRIENTS, MAX_RECIPE_INGREDIENTS } from '../../_lib/foodLibrary';
import { foodAmountUnits, foodUnitOptionLabel } from '../../_lib/foodPortions';
import { restoreDialogFocus } from '../../_lib/dialogLayers';
import { workspaceGuard } from '../../_lib/localData';
import type { AiRecipeCandidate, CatalogFood, FoodRecipe, FoodSearchResult, RecipeIngredient } from '../../_lib/types';

type DraftIngredient = RecipeIngredient & { quantity: string; suggestedName?: string };

function RecipeFoodPicker({ recipeId, onChoose, onClose }: {
    recipeId: string; onChoose: (ingredient: RecipeIngredient) => boolean; onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [dismiss, setDismiss] = useState(false);
    const chosen = useRef(false);
    const [error, setError] = useState('');
    const results = searchLibrary([], query).filter(item => item.id !== recipeId && !item.error);
    return <FoodLibrarySheet id="recipeFoodPicker" title="Choose Food" nested compact dismiss={dismiss} onClose={onClose}
        initialFocus="#recipeFoodSearch">
        <div className="food-library-form">
            <input type="search" id="recipeFoodSearch" aria-label="Search recipe ingredients" className="form-input"
                placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} />
            {!results.length && <p role="status">{query.trim() ? 'No matching foods.' : 'No foods available in your library.'}</p>}
            <ul className="food-library-list">{results.map(({ id, food }) => <li className="food-library-row" key={id}>
                <button type="button" className="food-library-result" disabled={dismiss} onClick={() => {
                    if (chosen.current) return;
                    try {
                        const resolved = resolveFood(id, libraryData().foods, new Set([recipeId]));
                        const unit = foodAmountUnits(resolved)[0];
                        if (!unit || !onChoose({ foodId: id, amount: 1, unit })) return;
                        chosen.current = true;
                        setDismiss(true);
                    } catch { setError('This food cannot be added. Check for circular recipe references or choose another food.'); }
                }}><span className="food-library-result-copy"><strong>{food.name}</strong>
                    {libraryBrand(food.brand) && <span className="food-library-brand">{libraryBrand(food.brand)}</span>}
                </span></button>
            </li>)}</ul>
            {error && <p role="alert">{error}</p>}
        </div>
    </FoodLibrarySheet>;
}

export default function RecipeEditor({ food, candidate, onSave, onCancel, renderPreview }: {
    food?: CatalogFood; candidate?: AiRecipeCandidate; onSave: (food: CatalogFood) => void; onCancel: () => void;
    renderPreview?: (food: FoodSearchResult | null) => ReactNode;
}) {
    const [id] = useState(() => food?.id || generateId('recipe'));
    const [name, setName] = useState(food?.name || candidate?.name || '');
    const [brand, setBrand] = useState(food?.brand || '');
    const [description, setDescription] = useState(food?.description || '');
    const [ingredients, setIngredients] = useState<DraftIngredient[]>(() =>
        food?.recipe?.ingredients.map(item => ({ ...item, quantity: String(item.amount) })) || candidate?.ingredients.map(item => {
            const matches = [...libraryData().foods.values()].filter(food => food.name.toLocaleLowerCase() === item.name.toLocaleLowerCase());
            return { foodId: matches.length === 1 ? matches[0].id : '', amount: item.amount, quantity: String(item.amount), unit: item.unit, suggestedName: item.name };
        }) || []);
    const [yieldAmount, setYieldAmount] = useState(String(food?.recipe?.yield.amount || candidate?.yield.amount || 1));
    const [yieldUnit, setYieldUnit] = useState<FoodRecipe['yield']['unit']>(food?.recipe?.yield.unit || candidate?.yield.unit || 'serving');
    const [error, setError] = useState('');
    const [picker, setPicker] = useState<'library' | 'barcode' | null>(null);
    const [isCurrent] = useState(() => workspaceGuard());
    const chooseButton = useRef<HTMLButtonElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const scannedIndex = useRef<number | null>(null);
    const { foods } = libraryData();
    const options = [...foods.values()].filter(item => item.id !== id);
    const draft: CatalogFood = { id, kind: 'recipe', name, brand, description, emoji: food?.emoji, defaultUnit: yieldUnit === 'ml' ? 'ml' : 'g',
        kcalPer100: 0, protPer100: 0, carbPer100: 0, fatPer100: 0,
        recipe: { ingredients: ingredients.map(item => ({
            ...(item.barcodeFood ? { barcodeFood: item.barcodeFood } : { foodId: item.foodId }),
            amount: item.quantity.trim() ? Number(item.quantity) : NaN, unit: item.unit,
        })),
            yield: { amount: yieldAmount.trim() ? Number(yieldAmount) : NaN, unit: yieldUnit } } };
    foods.set(id, draft);
    let computed: ReturnType<typeof resolveFood> | null = null;
    try { computed = resolveFood(id, foods); } catch { /* Validate incomplete drafts on submit. */ }
    const changeIngredient = (index: number, patch: Partial<Pick<DraftIngredient, 'quantity' | 'unit'>>) =>
        setIngredients(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
    const atLimit = ingredients.length >= MAX_RECIPE_INGREDIENTS;
    const addIngredient = (ingredient: RecipeIngredient) => {
        if (!isCurrent() || atLimit) return false;
        setIngredients(items => items.length >= MAX_RECIPE_INGREDIENTS ? items : [...items, { ...ingredient, quantity: String(ingredient.amount) }]);
        setError('');
        return true;
    };
    return <><form ref={formRef} className="food-library-form" onSubmit={event => {
        event.preventDefault();
        if (picker || !isCurrent()) return;
        try {
            const calculated = resolveFood(id, foods);
            onSave({ ...draft, ...Object.fromEntries(NUTRIENTS.map(key => [key, calculated[key]])) });
        } catch { setError('Choose valid ingredients and units, enter a name, positive quantities and yield, and remove circular references.'); }
    }}>
        {renderPreview ? renderPreview(computed) : <h3>{food ? 'Edit recipe' : 'Create recipe'}</h3>}
        <label htmlFor="recipeName">Recipe name</label><input autoFocus={!renderPreview} id="recipeName" className="form-input" required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
        <label htmlFor="recipeBrand">Brand (optional)</label><input id="recipeBrand" className="form-input" maxLength={200} value={brand} onChange={e => setBrand(e.target.value)} />
        <label htmlFor="recipeDescription">Description (optional)</label><textarea id="recipeDescription" className="form-input" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} />
        <p>Ingredients</p>
        {ingredients.map((item, index) => {
            let resolved: FoodSearchResult | undefined = item.barcodeFood;
            if (item.foodId) {
                try { resolved = resolveFood(item.foodId, foods); } catch { /* Missing references stay visible for repair. */ }
            }
            const units = resolved ? foodAmountUnits(resolved) : [];
            if (!units.includes(item.unit)) units.unshift(item.unit);
            return <fieldset key={index} className="recipe-ingredient"><legend>Ingredient {index + 1}{item.suggestedName ? `: ${item.suggestedName}` : ''}</legend>
                {item.barcodeFood ? <p><strong>{item.barcodeFood.name}</strong> · Scanned barcode</p> :
                <select aria-label={`Ingredient ${index + 1} food`} className="form-input" value={item.foodId} required onChange={e => {
                    const chosen = options.find(option => option.id === e.target.value);
                    const foodId = e.target.value;
                    let unit: RecipeIngredient['unit'] = chosen?.defaultUnit || 'g';
                    try { unit = foodAmountUnits(resolveFood(foodId, foods))[0] || unit; } catch {}
                    setIngredients(items => items.map((row, i) => i === index ? { ...row, foodId, unit, barcodeFood: undefined } : row));
                }}><option value="">Choose a food</option>{!options.some(option => option.id === item.foodId) && item.foodId && <option value={item.foodId}>Missing ingredient — choose a replacement</option>}
                    {options.map(option => <option key={option.id} value={option.id}>{option.name} {libraryBrand(option.brand)}</option>)}</select>}
                <div className="saved-food-amount-row"><input aria-label={`Ingredient ${index + 1} amount`} className="form-input" type="number" required min="0.000001" step="any" value={item.quantity} onChange={e => changeIngredient(index, { quantity: e.target.value })} />
                    <select aria-label={`Ingredient ${index + 1} unit`} className="form-input" value={item.unit} onChange={e => changeIngredient(index, { unit: e.target.value as typeof item.unit })}>
                        {units.map(unit => <option key={unit} value={unit}>{foodUnitOptionLabel(resolved || draft, unit)}</option>)}</select></div>
                <button type="button" className="option-btn" onClick={() => setIngredients(items => items.filter((_, i) => i !== index))}>Remove ingredient {index + 1}</button>
            </fieldset>;
        })}
        {candidate ? <button type="button" className="option-btn" disabled={!options.length || atLimit} onClick={() => {
            const first = options[0];
            if (first) addIngredient({ foodId: first.id, amount: 1, unit: first.recipe?.yield.unit === 'serving' ? 'serving' : first.defaultUnit });
        }}>Add ingredient</button> : <div className="food-library-actions">
            <button ref={chooseButton} type="button" className="option-btn" disabled={atLimit} onClick={() => { if (isCurrent()) setPicker('library'); }}>Choose Food</button>
            <button type="button" className="option-btn" disabled={atLimit} onClick={() => { if (isCurrent()) setPicker('barcode'); }}>Scan Barcode</button>
        </div>}
        {candidate && !options.length && <p>Add foods to your library to match the recipe ingredients.</p>}
        {atLimit && <p className="food-library-hint">Recipes can contain up to {MAX_RECIPE_INGREDIENTS} ingredients.</p>}
        <label htmlFor="recipeYield">Final yield</label><div className="saved-food-amount-row"><input id="recipeYield" className="form-input" type="number" required min="0.000001" step="any" value={yieldAmount} onChange={e => setYieldAmount(e.target.value)} />
            <select className="form-input" aria-label="Yield unit" value={yieldUnit} onChange={e => setYieldUnit(e.target.value as typeof yieldUnit)}><option value="serving">servings</option><option value="g">g final weight</option><option value="ml">ml final volume</option></select></div>
        {computed ? <p role="status">{computed.kcalPer100.toFixed(1)} kcal · P {computed.protPer100.toFixed(1)} g · C {computed.carbPer100.toFixed(1)} g · F {computed.fatPer100.toFixed(1)} g per {yieldUnit === 'serving' ? 'serving' : `100 ${yieldUnit}`}</p> : <p role="status">Nutrition unavailable until all ingredients and yield are valid.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="food-library-actions"><button type="button" className="option-btn" onClick={onCancel}>Cancel</button><button type="submit" className="option-btn active">Save recipe</button></div>
    </form>
    {picker && createPortal(picker === 'library' ?
        <RecipeFoodPicker recipeId={id} onChoose={addIngredient} onClose={() => setPicker(null)} /> :
        <BarcodeSearchPopup isOpen mode="recipe" onAddIngredient={ingredient => {
            if (!addIngredient(ingredient)) return false;
            scannedIndex.current = ingredients.length + 1;
            return true;
        }} onClose={() => {
            setPicker(null);
            if (!isCurrent()) return;
            const target = scannedIndex.current === null ? chooseButton.current :
                formRef.current?.querySelector<HTMLInputElement>(`[aria-label="Ingredient ${scannedIndex.current} amount"]`);
            scannedIndex.current = null;
            if (target) restoreDialogFocus(target);
        }} />, document.body)}
    </>;
}
