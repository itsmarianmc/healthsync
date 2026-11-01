// Font Awesome Free icons already available in the application.
export const FOOD_ICONS = [
    'fa-solid fa-utensils', 'fa-solid fa-bowl-food', 'fa-solid fa-apple-whole',
    'fa-solid fa-carrot', 'fa-solid fa-lemon', 'fa-solid fa-egg',
    'fa-solid fa-drumstick-bite', 'fa-solid fa-fish', 'fa-solid fa-bread-slice',
    'fa-solid fa-cheese', 'fa-solid fa-pizza-slice', 'fa-solid fa-burger',
    'fa-solid fa-cookie-bite', 'fa-solid fa-ice-cream', 'fa-solid fa-mug-hot',
    'fa-solid fa-glass-water', 'fa-solid fa-bottle-water',
] as const;

export function validatedFoodIcon(value: unknown): string | undefined {
    return typeof value === 'string' && FOOD_ICONS.some(icon => icon === value) ? value : undefined;
}
