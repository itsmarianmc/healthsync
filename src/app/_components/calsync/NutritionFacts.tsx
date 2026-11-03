import type { CSSProperties } from 'react';
import type { foodNutrition } from '../../_lib/foodEntry';
import { formatFoodNumber } from '../../_lib/foodPortions';

export default function NutritionFacts({ nutrition }: { nutrition: ReturnType<typeof foodNutrition> | null }) {
    // Segment sizes represent macro energy shares, never daily-value percentages.
    const fat = (nutrition?.fat || 0) * 9;
    const carbs = (nutrition?.carb || 0) * 4;
    const protein = (nutrition?.prot || 0) * 4;
    const total = fat + carbs + protein;
    const fatEnd = total > 0 ? fat / total * 360 : 0;
    const carbsEnd = total > 0 ? (fat + carbs) / total * 360 : 0;
    const segment = (start: number, end: number, color: string) =>
        `${color} ${start}deg ${Math.max(start, end - Math.min(2, (end - start) / 2))}deg, var(--surface) ${Math.max(start, end - Math.min(2, (end - start) / 2))}deg ${end}deg`;
    const ring = total > 0 && Number.isFinite(total) ? `conic-gradient(${segment(0, fatEnd, 'var(--food-fat)')}, ${segment(fatEnd, carbsEnd, 'var(--food-carbs)')}, ${segment(carbsEnd, 360, 'var(--food-protein)')})` : 'var(--surface3)';
    return <section className="food-edit-facts" aria-label="Nutrition Facts">
        <h3>Nutrition Facts <i className="fa-solid fa-circle-info" aria-label="Nutrition for the selected portion" title="Nutrition for the selected portion" /></h3>
        <div className="food-edit-nutrition">
            <dl className="food-edit-macros">{[['Fat', 'fat'], ['Carbs', 'carb'], ['Protein', 'prot']].map(([label, key]) =>
                <div key={key} className={`food-edit-macro food-edit-${key}`}><dt>{label}</dt><dd>{nutrition ? `${formatFoodNumber(nutrition[key as 'fat' | 'carb' | 'prot'])} g` : '—'}</dd></div>)}</dl>
            <div className="food-edit-ring" style={{ '--food-ring': ring } as CSSProperties}>
                <div><strong>{formatFoodNumber(nutrition?.kcal)}</strong><span>kcal</span></div>
            </div>
        </div>
    </section>;
}

