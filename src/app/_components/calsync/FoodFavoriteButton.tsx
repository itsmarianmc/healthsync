'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { isFoodFavorite, setFoodFavorite } from '../../_lib/foodLibrary';
import { workspaceGuard } from '../../_lib/localData';
import type { FoodSearchResult } from '../../_lib/types';

export default function FoodFavoriteButton({ food, label = food.name, onChange, onError }: {
    food: FoodSearchResult; label?: string;
    onChange?: (food: FoodSearchResult) => void; onError?: () => void;
}) {
    const { retrySync, showToast } = useAuth();
    const [isCurrent] = useState(() => workspaceGuard());
    const [, refresh] = useState(0);
    useEffect(() => {
        const update = () => { if (isCurrent()) refresh(value => value + 1); };
        window.addEventListener('storage', update);
        return () => window.removeEventListener('storage', update);
    }, [isCurrent]);
    const favorite = isFoodFavorite(food);
    return <button type="button" className="food-detail-favorite" aria-label={`Favorite ${label}`} aria-pressed={favorite} onClick={() => {
        if (!isCurrent()) return;
        try {
            const next = setFoodFavorite(food, !isFoodFavorite(food));
            onChange?.(next);
            void retrySync();
        } catch {
            if (onError) onError();
            else showToast('Could not update favorites on this device.');
        }
    }}><i className={favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" /></button>;
}
