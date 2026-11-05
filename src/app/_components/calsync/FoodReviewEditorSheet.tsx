'use client';

import { useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodEditor from './FoodEditor';
import RecipeEditor from './RecipeEditor';
import { libraryData } from '../../_lib/foodLibrary';
import { workspaceGuard } from '../../_lib/localData';
import type { CatalogFood, CustomFood, FoodSearchResult } from '../../_lib/types';

export default function FoodReviewEditorSheet({ food, recipe = false, onSaveFood, onSaveRecipe, onClose }: {
    food: FoodSearchResult; recipe?: boolean; onSaveFood: (food: CustomFood) => void;
    onSaveRecipe?: (food: CatalogFood) => void; onClose: () => void;
}) {
    const [dismiss, setDismiss] = useState(false);
    const [isCurrent] = useState(() => workspaceGuard());
    return <FoodLibrarySheet id="foodReviewEditor" title={recipe ? 'Edit recipe' : 'Edit food details'} nested
        dismiss={dismiss} onClose={onClose} onBack={() => setDismiss(true)} backLabel="Back to food preview"
        initialFocus={recipe ? '#recipeName' : '#customFoodName'}>
        {recipe ? <RecipeEditor candidate={food.aiRecipeCandidate}
            food={food.catalogFoodId ? libraryData().foods.get(food.catalogFoodId) : undefined}
            onCancel={() => setDismiss(true)} onSave={next => {
                if (dismiss || !isCurrent()) return;
                onSaveRecipe?.(next); setDismiss(true);
            }} /> : <FoodEditor food={food} onCancel={() => setDismiss(true)} onSave={next => {
                if (dismiss || !isCurrent()) return;
                onSaveFood(next); setDismiss(true);
            }} />}
    </FoodLibrarySheet>;
}
