'use client';

import { useEffect, useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import FoodCreationSheet from './FoodCreationSheet';
import FoodDetailSheet from './FoodDetailSheet';
import FoodCreateChoiceSheet from './FoodCreateChoiceSheet';
import { libraryBrand, libraryPortionLabel } from './foodLibraryPresentation';
import { useAuth } from '../../_context/AuthContext';
import { workspaceGuard } from '../../_lib/localData';
import { libraryData, searchLibrary, deleteLibraryFood, resolveFood, type LibraryItem } from '../../_lib/foodLibrary';
import { prependFoodSelection } from '../../_lib/foodBatch';
import type { CatalogFood, FoodSearchResult } from '../../_lib/types';

export default function CustomFoodsModal({ onClose, onOpenSearch }: { onClose: () => void; onOpenSearch: () => void }) {
    const { retrySync, showToast } = useAuth();
    const [isCurrent] = useState(() => workspaceGuard());
    const [editing, setEditing] = useState<'food' | 'recipe' | null>(null);
    const [selected, setSelected] = useState<LibraryItem | null>(null);
    const [editOpener, setEditOpener] = useState<HTMLButtonElement | null>(null);
    const [choosing, setChoosing] = useState(false);
    const [dismiss, setDismiss] = useState(false);
    const openSearch = useRef(false);
    const [revision, refresh] = useState(0);
    const [error, setError] = useState('');
    let foods: CatalogFood[] = [], unavailable = false;
    try { foods = searchLibrary([], '').map(item => item.food as CatalogFood); } catch { unavailable = true; }
    useEffect(() => {
        const update = () => { if (isCurrent()) refresh(n => n + 1); };
        window.addEventListener('storage', update);
        return () => window.removeEventListener('storage', update);
    }, [isCurrent]);
    return <><FoodLibrarySheet id="customFoods" title="Custom Food" dismiss={dismiss} onClose={() => {
        onClose();
        if (openSearch.current && isCurrent()) onOpenSearch();
    }} covered={!!selected || choosing || !!editing} returnFocusTo={dismiss ? undefined : editOpener}>
        {unavailable && <p role="alert">The saved library could not be read. Existing storage has been preserved. Export your data before repairing browser storage.</p>}
                <button type="button" className="add-workout custom-food-add" onClick={event => { setEditOpener(event.currentTarget); setChoosing(true); }}><span className="add-wo-btn"><i className="fas fa-plus" aria-hidden="true" /></span><span className="add-wo-text">Create food</span></button>
                <ul className="food-library-list">{foods.map(food => {
                    let label = <>Nutrition unavailable — edit to repair</>;
                    try {
                        const resolved = resolveFood(food.id, libraryData().foods);
                        label = <>
                            {libraryPortionLabel(resolved)}
                        </>;
                    } catch {}

                    return (
                        <li key={food.id} className="food-library-row">
                            <button
                                type="button"
                                className="food-library-result"
                                aria-label={`View ${food.name}`}
                                onClick={event => {
                                    if (!isCurrent()) return;
                                    setEditOpener(event.currentTarget);
                                    let resolved: FoodSearchResult = food, error: string | undefined;
                                    try { resolved = resolveFood(food.id, libraryData().foods); }
                                    catch { error = 'Nutrition unavailable. Edit this food to repair it.'; }
                                    setSelected({ id: food.id, food: resolved, saved: true, favorite: libraryData().favorites.has(food.id), error });
                                }}
                            >
                                <span className="food-library-result-copy">
                                    <strong>{food.name}</strong>
                                    <span>
                                        {libraryBrand(food.brand) ? `${libraryBrand(food.brand)} · ` : ''}
                                        {label}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className="option-btn"
                                aria-label={`Delete ${food.name}`}
                                onClick={() => {
                                    if (!isCurrent() || !window.confirm(`Delete "${food.name}"? Logged entries will be kept.`)) return;
                                    try {
                                        deleteLibraryFood(food.id);
                                        refresh(revision + 1);
                                        void retrySync();
                                    } catch {
                                        setError('This food is used by a recipe. Edit or delete that recipe first.');
                                        showToast('Food kept because a recipe uses it.');
                                    }
                                }}
                            >
                                <i className="fas fa-trash" />
                            </button>
                        </li>
                    );
                })}</ul>
        {error && <p role="alert">{error}</p>}
    </FoodLibrarySheet>
    {choosing && <FoodCreateChoiceSheet onClose={kind => {
        setChoosing(false);
        if (kind && isCurrent()) { setEditing(kind); setError(''); }
    }} />}
    {editing && <FoodCreationSheet kind={editing} onClose={search => {
        setEditing(null);
        if (search) {
            openSearch.current = true;
            setDismiss(true);
        }
    }} />}
    {selected && <FoodDetailSheet item={selected} onClose={() => setSelected(null)} backLabel="Back to created foods" onAdd={item => {
        if (!isCurrent()) return false;
        try { return prependFoodSelection(item); } catch { return false; }
    }} />}
    </>;
}
