'use client';

import { useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodEditor from './FoodEditor';
import RecipeEditor from './RecipeEditor';
import { workspaceGuard } from '../../_lib/localData';
import { saveLibraryFood } from '../../_lib/foodLibrary';
import { useAuth } from '../../_context/AuthContext';
import type { CatalogFood } from '../../_lib/types';

export default function FoodCreationSheet({ kind, onClose }: { kind: 'food' | 'recipe'; onClose: () => void }) {
    const [isCurrent] = useState(() => workspaceGuard());
    const [dismiss, setDismiss] = useState(false);
    const saved = useRef(false);
    const { retrySync } = useAuth();
    const save = (food: CatalogFood) => {
        if (saved.current || !isCurrent()) return;
        saveLibraryFood(food); // Editors keep validation/storage failures editable.
        saved.current = true;
        void retrySync();
        setDismiss(true);
    };
    return <FoodLibrarySheet id="createFood" title={kind === 'food' ? 'Create food' : 'Create recipe'} nested dismiss={dismiss}
        onClose={onClose} onBack={() => setDismiss(true)} backLabel="Back to created foods"
        initialFocus={kind === 'food' ? '#customFoodName' : '#recipeName'}>
        {kind === 'food' ? <FoodEditor onSave={food => save({ ...food, kind: 'food' })} onCancel={() => setDismiss(true)} /> :
            <RecipeEditor onSave={save} onCancel={() => setDismiss(true)} />}
    </FoodLibrarySheet>;
}
