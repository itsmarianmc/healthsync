'use client';

import { useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';

export default function FoodCreateChoiceSheet({ onClose }: { onClose: (kind: 'food' | 'recipe' | null) => void }) {
    const choice = useRef<'food' | 'recipe' | null>(null);
    const [dismiss, setDismiss] = useState(false);
    return <FoodLibrarySheet id="foodCreateChoice" title="Create new" nested compact dismiss={dismiss} onClose={() => onClose(choice.current)} bodyClassName="food-create-choice-body">
        <div className="ai-method-grid food-create-choice-grid">
            {(['food', 'recipe'] as const).map(kind => <button type="button" key={kind} className="ai-method-card" disabled={dismiss} onClick={() => {
                choice.current = kind; setDismiss(true);
            }}>
                <span className="ai-method-icon"><i className={kind === 'food' ? 'fa-solid fa-apple-whole' : 'fa-solid fa-utensils'} aria-hidden="true" /></span>
                <span className="ai-method-label">{kind === 'food' ? 'Food' : 'Recipe'}</span>
            </button>)}
        </div>
    </FoodLibrarySheet>;
}
