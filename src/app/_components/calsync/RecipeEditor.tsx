'use client';

import { useState, type ReactNode } from 'react';
import { libraryBrand } from './foodLibraryPresentation';
import { generateId } from '../../_lib/ids';
import { libraryData, resolveFood, NUTRIENTS } from '../../_lib/foodLibrary';
import { foodAmountUnits, foodUnitOptionLabel } from '../../_lib/foodPortions';
import type { AiRecipeCandidate, CatalogFood, FoodRecipe, FoodSearchResult } from '../../_lib/types';

export default function RecipeEditor({ food, candidate, onSave, onCancel, renderPreview }: {
    food?: CatalogFood; candidate?: AiRecipeCandidate; onSave: (food: CatalogFood) => void; onCancel: () => void;
    renderPreview?: (food: FoodSearchResult | null) => ReactNode;
}) {
    const [id] = useState(() => food?.id || generateId('recipe'));
    const [name, setName] = useState(food?.name || candidate?.name || '');
    const [brand, setBrand] = useState(food?.brand || '');
    const [description, setDescription] = useState(food?.description || '');
    const [ingredients, setIngredients] = useState<(FoodRecipe['ingredients'][number] & { quantity: string; suggestedName?: string })[]>(() =>
        food?.recipe?.ingredients.map(item => ({ ...item, quantity: String(item.amount) })) || candidate?.ingredients.map(item => {
            const matches = [...libraryData().foods.values()].filter(food => food.name.toLocaleLowerCase() === item.name.toLocaleLowerCase());
            return { foodId: matches.length === 1 ? matches[0].id : '', amount: item.amount, quantity: String(item.amount), unit: item.unit, suggestedName: item.name };
        }) || []);
    const [yieldAmount, setYieldAmount] = useState(String(food?.recipe?.yield.amount || candidate?.yield.amount || 1));
    const [yieldUnit, setYieldUnit] = useState<FoodRecipe['yield']['unit']>(food?.recipe?.yield.unit || candidate?.yield.unit || 'serving');
    const [error, setError] = useState('');
    const { foods } = libraryData();
    const options = [...foods.values()].filter(item => item.id !== id);
    const draft: CatalogFood = { id, kind: 'recipe', name, brand, description, emoji: food?.emoji, defaultUnit: yieldUnit === 'ml' ? 'ml' : 'g',
        kcalPer100: 0, protPer100: 0, carbPer100: 0, fatPer100: 0,
        recipe: { ingredients: ingredients.map(({ quantity, ...item }) => ({ ...item, amount: quantity.trim() ? Number(quantity) : NaN })),
            yield: { amount: yieldAmount.trim() ? Number(yieldAmount) : NaN, unit: yieldUnit } } };
    foods.set(id, draft);
    let computed: ReturnType<typeof resolveFood> | null = null;
    try { computed = resolveFood(id, foods); } catch { /* Validate incomplete drafts on submit. */ }
    const changeIngredient = (index: number, patch: Partial<typeof ingredients[number]>) => setIngredients(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
    return <form className="food-library-form" onSubmit={event => {
        event.preventDefault();
        try {
            const calculated = resolveFood(id, foods);
            onSave({ ...draft, ...Object.fromEntries(NUTRIENTS.map(key => [key, calculated[key]])) });
        } catch { setError('Choose valid ingredients and units, enter a name, positive quantities and yield, and remove circular references.'); }
    }}>
        {renderPreview ? renderPreview(computed) : <h3>{food ? 'Edit recipe' : 'Create recipe'}</h3>}
        <label htmlFor="recipeName">Recipe name</label><input autoFocus={!renderPreview} id="recipeName" className="form-input" required maxLength={200} value={name} onChange={e => setName(e.target.value)} />
        <label htmlFor="recipeBrand">Brand (optional)</label><input id="recipeBrand" className="form-input" maxLength={200} value={brand} onChange={e => setBrand(e.target.value)} />
        <label htmlFor="recipeDescription">Description (optional)</label><textarea id="recipeDescription" className="form-input" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} />
        <p>Ingredients from your library</p>
        {ingredients.map((item, index) => {
            let units = [item.unit];
            try { units = foodAmountUnits(resolveFood(item.foodId, foods)); } catch { /* Missing references stay visible for repair. */ }
            return <fieldset key={index} className="recipe-ingredient"><legend>Ingredient {index + 1}{item.suggestedName ? `: ${item.suggestedName}` : ''}</legend>
                <select aria-label={`Ingredient ${index + 1} food`} className="form-input" value={item.foodId} required onChange={e => {
                    const chosen = options.find(option => option.id === e.target.value);
                    let unit: FoodRecipe['ingredients'][number]['unit'] = chosen?.defaultUnit || 'g';
                    try { unit = foodAmountUnits(resolveFood(e.target.value, foods))[0]; } catch {}
                    changeIngredient(index, { foodId: e.target.value, unit });
                }}><option value="">Choose a food</option>{!options.some(option => option.id === item.foodId) && item.foodId && <option value={item.foodId}>Missing ingredient — choose a replacement</option>}
                    {options.map(option => <option key={option.id} value={option.id}>{option.name} {libraryBrand(option.brand)}</option>)}</select>
                <div className="saved-food-amount-row"><input aria-label={`Ingredient ${index + 1} amount`} className="form-input" type="number" required min="0.000001" step="any" value={item.quantity} onChange={e => changeIngredient(index, { quantity: e.target.value })} />
                    <select aria-label={`Ingredient ${index + 1} unit`} className="form-input" value={item.unit} onChange={e => changeIngredient(index, { unit: e.target.value as typeof item.unit })}>
                        {units.map(unit => <option key={unit} value={unit}>{foodUnitOptionLabel(foods.get(item.foodId) || draft, unit)}</option>)}</select></div>
                <button type="button" className="option-btn" onClick={() => setIngredients(items => items.filter((_, i) => i !== index))}>Remove ingredient {index + 1}</button>
            </fieldset>;
        })}
        <button type="button" className="option-btn" disabled={!options.length || ingredients.length >= 100} onClick={() => setIngredients([...ingredients,
            { foodId: options[0].id, amount: 1, quantity: '1', unit: options[0].recipe?.yield.unit === 'serving' ? 'serving' : options[0].defaultUnit }])}>Add ingredient</button>
        {!options.length && <p>Add foods to your library before creating a recipe.</p>}
        <label htmlFor="recipeYield">Final yield</label><div className="saved-food-amount-row"><input id="recipeYield" className="form-input" type="number" required min="0.000001" step="any" value={yieldAmount} onChange={e => setYieldAmount(e.target.value)} />
            <select className="form-input" aria-label="Yield unit" value={yieldUnit} onChange={e => setYieldUnit(e.target.value as typeof yieldUnit)}><option value="serving">servings</option><option value="g">g final weight</option><option value="ml">ml final volume</option></select></div>
        {computed ? <p role="status">{computed.kcalPer100.toFixed(1)} kcal · P {computed.protPer100.toFixed(1)} g · C {computed.carbPer100.toFixed(1)} g · F {computed.fatPer100.toFixed(1)} g per {yieldUnit === 'serving' ? 'serving' : `100 ${yieldUnit}`}</p> : <p role="status">Nutrition unavailable until all ingredients and yield are valid.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="food-library-actions"><button type="button" className="option-btn" onClick={onCancel}>Cancel</button><button type="submit" className="option-btn active">Save recipe</button></div>
    </form>;
}
