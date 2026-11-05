'use client';

import { useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodEditor from './FoodEditor';
import RecipeEditor from './RecipeEditor';
import { workspaceGuard } from '../../_lib/localData';
import { saveLibraryFood } from '../../_lib/foodLibrary';
import { createFoodSelection, prependFoodSelection, selectionEntry } from '../../_lib/foodBatch';
import { useAuth } from '../../_context/AuthContext';
import type { CatalogFood } from '../../_lib/types';

export default function FoodCreationSheet({ kind, onClose }: { kind: 'food' | 'recipe'; onClose: (openSearch: boolean) => void }) {
    const [isCurrent] = useState(() => workspaceGuard());
    const [dismiss, setDismiss] = useState(false);
    const saved = useRef(false);
    const openSearch = useRef(false);
    const { retrySync } = useAuth();
    const save = (food: CatalogFood, temporary = false) => {
        if (saved.current || dismiss) return;
        if (!isCurrent()) return 'The food workspace changed. Reopen Create food to continue.';
        if (temporary) {
            const item = createFoodSelection({ ...food, temporary: true });
            selectionEntry(item, 0);
            if (!prependFoodSelection(item)) return 'Finish the pending food batch in Search, then try again.';
            openSearch.current = true;
        } else {
            saveLibraryFood(food);
            void retrySync();
        }
        saved.current = true;
        setDismiss(true);
    };
    return <FoodLibrarySheet id="createFood" title={kind === 'food' ? 'Create food' : 'Create recipe'} nested dismiss={dismiss}
        onClose={() => onClose(openSearch.current && isCurrent())} onBack={() => setDismiss(true)} backLabel="Back to created foods"
        initialFocus={kind === 'food' ? '#customFoodName' : '#recipeName'}>
        {kind === 'food' ? <FoodEditor allowTemporary onSave={(food, temporary) => save({ ...food, kind: 'food' }, temporary)} onCancel={() => setDismiss(true)} /> :
            <RecipeEditor onSave={save} onCancel={() => setDismiss(true)} />}
    </FoodLibrarySheet>;
}
