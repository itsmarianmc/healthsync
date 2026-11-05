'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { FoodSelection } from '../../_lib/foodBatch';

export default function FoodSelectionChips({ items, onRemove, onRemovingChange }: { items: FoodSelection[]; onRemove: (id: string) => boolean; onRemovingChange: (busy: boolean) => void }) {
    const strip = useRef<HTMLDivElement>(null);
    const positions = useRef(new Map<string, number>());
    const remove = useRef(onRemove);
    const [exiting, setExiting] = useState<string[]>([]);
    const pending = useRef(new Set<string>());
    useLayoutEffect(() => { remove.current = onRemove; });
    useLayoutEffect(() => {
        const el = strip.current!;
        const next = new Map<string, number>();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (const chip of el.querySelectorAll<HTMLButtonElement>('[data-selection-id]')) {
            const id = chip.dataset.selectionId!, previous = positions.current.get(id);
            next.set(id, chip.offsetLeft);
            if (!reduced && (previous === undefined || previous !== chip.offsetLeft)) chip.animate(
                previous === undefined ? [{ transform: 'translateX(-32px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }]
                    : [{ transform: `translateX(${previous - chip.offsetLeft}px)` }, { transform: 'translateX(0)' }],
                { duration: 220, easing: 'ease-out' });
        }
        if (items[0] && !positions.current.has(items[0].id)) el.scrollLeft = 0;
        positions.current = next;
    }, [items]);
    return <div ref={strip} className="food-selection-chips" role="group" aria-label="Selected foods">{items.map(item =>
        <button type="button" key={item.id} data-selection-id={item.id} className="quick-btn" disabled={exiting.includes(item.id)}
            aria-label={`Remove ${item.food.name} from selection`} onClick={async event => {
                const button = event.currentTarget;
                const hadFocus = document.activeElement === button;
                if (exiting.includes(item.id)) return;
                pending.current.add(item.id); onRemovingChange(true);
                setExiting(current => [...current, item.id]);
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    const animation = button.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }],
                        { duration: 180, easing: 'ease-in', fill: 'forwards' });
                    try { await animation.finished; } catch { /* Cancellation still completes the requested removal. */ }
                    // Retain the final frame to prevent a flash before React removes the chip.
                    button.style.opacity = '0'; button.style.transform = 'scale(0)';
                    animation.cancel();
                }
                if (button.isConnected) {
                    if (hadFocus) {
                        const target = button.nextElementSibling || button.previousElementSibling || document.getElementById('savedFoodsSearch');
                        (target as HTMLElement | null)?.focus();
                    }
                    if (!remove.current(item.id)) {
                        button.style.opacity = ''; button.style.transform = '';
                    }
                    setExiting(current => current.filter(id => id !== item.id));
                }
                pending.current.delete(item.id); onRemovingChange(pending.current.size > 0);
            }}><span>{item.food.name}</span><i className="fa-solid fa-xmark" aria-hidden="true" /></button>)}</div>;
}
