'use client';

import { useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodEditSheet from './FoodEditSheet';
import FoodAvatar from './FoodAvatar';
import FoodFavoriteButton from './FoodFavoriteButton';
import NutritionFacts from './NutritionFacts';
import { isBarcodeFood, libraryBrand } from './foodLibraryPresentation';
import { useAuth } from '../../_context/AuthContext';
import { workspaceGuard } from '../../_lib/localData';
import { deleteLibraryFood, libraryData, type LibraryItem } from '../../_lib/foodLibrary';
import { createFoodSelection, selectionEntry, type FoodSelection } from '../../_lib/foodBatch';
import { foodAmountToBase, foodAmountUnits, foodUnitLabel, foodUnitOptionLabel, foodConversionIssue, type FoodAmountUnit } from '../../_lib/foodPortions';
import type { CatalogFood } from '../../_lib/types';

export default function FoodDetailSheet({ item, onClose, onAdd, backLabel = 'Back to saved foods' }: {
    item: LibraryItem; onClose: () => void; onAdd: (item: FoodSelection) => boolean; backLabel?: string;
}) {
    const { retrySync } = useAuth();
    const [isCurrent] = useState(() => workspaceGuard());
    const [selected, setSelected] = useState(item);
    const [amount, setAmount] = useState(() => createFoodSelection(item.food));
    const [editing, setEditing] = useState<CatalogFood | null>(null);
    const [editOpener, setEditOpener] = useState<HTMLButtonElement | null>(null);
    const [dismiss, setDismiss] = useState(false);
    const [error, setError] = useState('');
    let nutrition: ReturnType<typeof selectionEntry> | null = null;
    let base: ReturnType<typeof foodAmountToBase> | null = null;
    try {
        nutrition = selectionEntry(amount, 0);
        base = foodAmountToBase(amount.food, Number(amount.amount), amount.unit);
    } catch {}
    return <><FoodLibrarySheet id="savedFoodDetail" title="Food details" nested covered={!!editing} returnFocusTo={editOpener}
        onClose={onClose} dismiss={dismiss} onBack={() => setDismiss(true)} backLabel={backLabel}>
        <div className="food-library-form saved-food-detail">
            <div className="food-detail-heading"><FoodAvatar food={selected.food} /><h3 title={selected.food.name}>{selected.food.name}</h3>
                <FoodFavoriteButton food={{ ...selected.food, selectedAmount: { amount: Number(amount.amount), unit: amount.unit } }} onChange={food => {
                    setSelected(current => ({ ...current, id: food.catalogFoodId!, food, saved: true }));
                    setAmount(current => ({ ...current, food }));
                    setError('');
                }} onError={() => setError('Could not update favorites on this device.')} />
            </div>
            {libraryBrand(selected.food.brand) && <p>{libraryBrand(selected.food.brand)}</p>}
            {nutrition && <p>Nutrition for {amount.amount} {foodUnitLabel(amount.food, amount.unit)}</p>}
            {selected.error ? <p role="alert">{selected.error}</p> : <><NutritionFacts nutrition={nutrition} />
                <section className="food-detail-portion"><h3>Portion size</h3>
                    <div className="saved-food-amount-row"><label>Amount ({foodUnitLabel(amount.food, amount.unit)})<input className="form-input" type="number" inputMode="decimal" min="0.000001" step="any" required value={amount.amount} onChange={event => setAmount({ ...amount, amount: event.target.value })} /></label>
                        <label>Amount unit<select aria-label="Amount unit" className="form-input" value={amount.unit} onChange={event => {
                            const unit = event.target.value as FoodAmountUnit;
                            let quantity = amount.amount;
                            try { quantity = String(foodAmountToBase(amount.food, Number(amount.amount), amount.unit).amount / foodAmountToBase(amount.food, 1, unit).amount); } catch { /* Preserve input until the quantity can be converted. */ }
                            setAmount({ ...amount, amount: quantity, unit });
                        }}>{foodAmountUnits(amount.food).map(unit => <option key={unit} value={unit}>{foodUnitOptionLabel(amount.food, unit)}</option>)}</select></label>
                    </div>
                    {base && base.unit !== amount.unit && amount.food.recipeSnapshot?.recipe.yield.unit !== 'serving' && amount.food.barcodeAmounts?.basis !== 'serving' && <p className="food-library-hint">{Number(base.amount.toFixed(6))} {base.unit} total</p>}
                </section>
                {!nutrition && <p className="food-portion-notice" role="status">{foodConversionIssue(amount.food, amount.unit) || 'Enter a valid amount and unit to calculate nutrition.'}</p>}
            </>}
            <button type="button" className="saved-food-log" disabled={dismiss || !!selected.error || !nutrition} onClick={() => {
                if (!isCurrent() || dismiss) return;
                try {
                    selectionEntry(amount, 0);
                    if (onAdd(amount)) setDismiss(true);
                    else setError('Could not save the selection. Finish pending food logging and check device storage.');
                } catch { setError('Enter a positive amount in an available unit.'); }
            }}>Add to selection</button>
            {selected.saved && <div className="food-library-actions">{!isBarcodeFood(selected.food) && <button type="button" className="option-btn" onClick={event => {
                if (!isCurrent()) return;
                setEditOpener(event.currentTarget);
                setEditing(libraryData().foods.get(selected.id) || null);
            }}>Edit</button>}
                <button type="button" className="option-btn" onClick={() => {
                    if (!isCurrent() || !window.confirm(`Delete "${selected.food.name}" from the library? This does not delete historical entries.`)) return;
                    try { deleteLibraryFood(selected.id); setDismiss(true); void retrySync(); }
                    catch { setError('This food is used by a recipe. Edit or delete that recipe first.'); }
                }}>Delete</button>
            </div>}
            {selected.food.recipeSnapshot && <section><h4>Recipe ingredients</h4><ul>{selected.food.recipeSnapshot.ingredients.map((ingredient, index) => <li key={index}>{ingredient.food.name}: {ingredient.amount} {foodUnitLabel(ingredient.food, ingredient.unit)}</li>)}</ul>
                <p>Yield: {selected.food.recipeSnapshot.recipe.yield.amount} {selected.food.recipeSnapshot.recipe.yield.unit}</p></section>}
        </div>
        {error && <p role="alert">{error}</p>}
    </FoodLibrarySheet>
    {editing && <FoodEditSheet food={editing} onClose={() => setEditing(null)} />}
    </>;
}
