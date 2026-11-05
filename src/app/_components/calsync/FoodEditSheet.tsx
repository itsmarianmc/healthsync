'use client';

import { useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import NutritionFacts from './NutritionFacts';
import FoodAvatar from './FoodAvatar';
import FoodFavoriteButton from './FoodFavoriteButton';
import FoodEditor from './FoodEditor';
import RecipeEditor from './RecipeEditor';
import { isBarcodeFood, libraryBrand } from './foodLibraryPresentation';
import { foodNutrition } from '../../_lib/foodEntry';
import { foodAmountToBase, foodAmountUnits, foodDefaultAmount, foodUnitLabel, foodUnitOptionLabel, type FoodAmountUnit } from '../../_lib/foodPortions';
import { libraryData, resolveFood, saveLibraryFood } from '../../_lib/foodLibrary';
import { workspaceGuard } from '../../_lib/localData';
import { useAuth } from '../../_context/AuthContext';
import type { CatalogFood, FoodSearchResult } from '../../_lib/types';

function FoodEditDetails({ food, initialFood }: { food: FoodSearchResult | null; initialFood: FoodSearchResult }) {
    const [amount, setAmount] = useState(() => String(foodDefaultAmount(initialFood).amount));
    const [unit, setUnit] = useState<FoodAmountUnit>(() => foodDefaultAmount(initialFood).unit);
    const units = food ? foodAmountUnits(food) : [];
    const activeUnit = units.includes(unit) ? unit : units[0] || '';
    let nutrition: ReturnType<typeof foodNutrition> | null = null;
    try {
        if (food && amount.trim()) {
            const base = foodAmountToBase(food, Number(amount), activeUnit);
            nutrition = foodNutrition(food, base.amount);
            if (!Object.values(nutrition).every(value => Number.isFinite(value) && value >= 0)) nutrition = null;
        }
    } catch {}
    return <div className="food-edit-details">
        <div className="food-edit-identity"><FoodAvatar food={food || initialFood} />
            <div className="food-preview-info"><div className="food-detail-heading"><h3 title={food?.name || initialFood.name}>{food?.name || initialFood.name}</h3>
                <FoodFavoriteButton food={{ ...initialFood, selectedAmount: { amount: Number(amount), unit: activeUnit } }} label={food?.name || initialFood.name} />
            </div>{libraryBrand(food?.brand) && <p>{libraryBrand(food?.brand)}</p>}</div></div>
        <NutritionFacts nutrition={nutrition} amountLabel={nutrition && food ? `${amount} ${foodUnitLabel(food, activeUnit)}` : undefined} />
        <section className="food-edit-portion" aria-label="Portion size"><h3>Portion size</h3>
            <div className="food-edit-portion-row"><div className="food-edit-portion-fields">
                <input className="form-input" aria-label="Preview amount" type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                <select className="form-input" aria-label="Preview amount unit" value={activeUnit} disabled={!food || !units.length} onChange={e => {
                    const next = e.target.value as FoodAmountUnit;
                    try {
                        if (food) setAmount(String(foodAmountToBase(food, Number(amount), activeUnit).amount / foodAmountToBase(food, 1, next).amount));
                    } catch { /* Preserve input until the quantity can be converted. */ }
                    setUnit(next);
                }}>{!units.length && <option value="">Portion unavailable</option>}{units.map(option => <option key={option} value={option}>{foodUnitOptionLabel(food || initialFood, option)}</option>)}</select>
            </div>
            <button type="button" className="option-btn" aria-label="Decrease preview portion" disabled={!Number.isFinite(Number(amount)) || Number(amount) <= 1} onClick={() => setAmount(String(Number(amount) - 1))}><i className="fa-solid fa-minus" aria-hidden="true" /></button>
            <button type="button" className="option-btn" aria-label="Increase preview portion" disabled={!amount.trim() || !Number.isFinite(Number(amount))} onClick={() => setAmount(String(Number(amount) + 1))}><i className="fa-solid fa-plus" aria-hidden="true" /></button></div>
            {!nutrition && <p role="status">Enter valid nutrition and a positive portion to preview.</p>}
        </section>
        {food?.recipeSnapshot && <section className="food-edit-ingredients" aria-label="Ingredients"><h3>Ingredients</h3>
            {food.recipeSnapshot.ingredients.map((ingredient, index) => <details className="food-edit-ingredient" key={`${ingredient.food.catalogFoodId || ingredient.food.name}-${index}`}>
                <summary><FoodAvatar food={ingredient.food} />
                    <span className="food-edit-ingredient-copy"><strong>{ingredient.food.name}</strong><span>{ingredient.amount} {foodUnitLabel(ingredient.food, ingredient.unit)}</span></span><i className="fa-solid fa-chevron-right" aria-hidden="true" /></summary>
                <p>{libraryBrand(ingredient.food.brand)}{libraryBrand(ingredient.food.brand) ? ' · ' : ''}{foodNutrition(ingredient.food, foodAmountToBase(ingredient.food, ingredient.amount, ingredient.unit as FoodAmountUnit).amount).kcal} kcal</p>
            </details>)}
        </section>}
    </div>;
}

export default function FoodEditSheet({ food, onClose }: { food: CatalogFood; onClose: () => void }) {
    const { retrySync } = useAuth();
    const [isCurrent] = useState(() => workspaceGuard());
    const [dismiss, setDismiss] = useState(false);
    let initialFood: FoodSearchResult = food;
    try { initialFood = resolveFood(food.id, libraryData().foods); } catch { /* Existing editor can repair a recipe. */ }
    const save = (next: CatalogFood) => {
        if (!isCurrent() || isBarcodeFood(food)) return;
        saveLibraryFood(next);
        void retrySync();
        setDismiss(true);
    };
    const preview = (draft: FoodSearchResult | null) => <FoodEditDetails food={draft} initialFood={initialFood} />;
    return <FoodLibrarySheet id="editFood" title={isBarcodeFood(food) ? 'Food details' : food.kind === 'recipe' ? 'Edit recipe' : 'Edit food details'} nested onClose={onClose} dismiss={dismiss}
        onBack={() => setDismiss(true)} backLabel="Back to food details" bodyClassName="food-edit-body">
        {isBarcodeFood(food) ? preview(initialFood) : food.kind === 'recipe' ? <RecipeEditor food={food} onSave={save} onCancel={() => setDismiss(true)} renderPreview={preview} />
            : <FoodEditor food={food} onSave={next => save({ ...next, kind: 'food' })} onCancel={() => setDismiss(true)} renderPreview={preview} />}
    </FoodLibrarySheet>;
}
