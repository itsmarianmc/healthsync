import type { CatalogFood, FoodEntry, FoodSearchResult, RecipeBarcodeFood, RecipeIngredient } from './types';
import { activeOwner } from './localData';
import { parseCustomFoods, readCustomFoods, readFavourites } from './customFoods';
import { foodAmountToBase, foodAmountUnits } from './foodPortions';
import { generateId } from './ids';

export const FOOD_LIBRARY_KEY = 'calsync_food_library_v1';
export const NUTRIENTS = ['kcalPer100', 'protPer100', 'carbPer100', 'fatPer100'] as const;
export const MAX_RECIPE_INGREDIENTS = 100;
export type LibraryChange = { id: string; foodId: string; at: number } & (
    { kind: 'definition'; food: CatalogFood | null } | { kind: 'favorite'; favorite: boolean }
);
export interface LibraryState { version: 1; changes: LibraryChange[]; pending: string[]; imported: string[] }
export interface LibraryItem { id: string; food: FoodSearchResult; favorite: boolean; latest?: FoodEntry; saved: boolean; error?: string }

function legacyId(value: string): string {
    // Fixed-size compatibility IDs avoid PostgreSQL's index-key limit; exact identity is checked separately.
    return [2166136261, 3335557771, 987654319, 1234567891].map(seed => {
        let hash = seed;
        for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(16).padStart(8, '0');
    }).join('');
}

export function foodIdentity(food: FoodSearchResult): string {
    return JSON.stringify([food.name.trim(), food.brand?.trim() || '', food.barcode || '',
        food.defaultUnit || (food.isLiquid ? 'ml' : 'g'), ...NUTRIENTS.map(key => food[key]),
        food.portion?.unit || '', food.portion?.amount || null, food.servingSize || null,
        ...(food.nutritionBasisAmount !== undefined && food.nutritionBasisAmount !== 100 ? [food.nutritionBasisAmount] : []),
        ...(food.barcodeAmounts ? [food.barcodeAmounts] : [])]);
}

function barcodeIdentity(food: FoodSearchResult): string | undefined {
    if (!food.barcode?.trim() || !(food.isBarcode || food.provenance === 'barcode')) return undefined;
    return `${food.barcode.trim()}:${food.barcodeAmounts?.basisLabel.includes('(prepared)') ? 'prepared' : 'as-sold'}`;
}

function sameFood(a: FoodSearchResult, b: FoodSearchResult): boolean {
    const recipeA = a.recipeSnapshot || ('kind' in a && a.kind === 'recipe');
    const recipeB = b.recipeSnapshot || ('kind' in b && b.kind === 'recipe');
    if (recipeA || recipeB) return !!a.catalogFoodId && a.catalogFoodId === b.catalogFoodId;
    const barcode = barcodeIdentity(a);
    const otherBarcode = barcodeIdentity(b);
    if (barcode || otherBarcode) return !!barcode && barcode === otherBarcode;
    return foodIdentity(a) === foodIdentity(b);
}

function preferredFood<T extends FoodSearchResult>(foods: T[]): T | undefined {
    return foods.find(food => food.barcodeAmounts && foodAmountUnits(food).length) || foods[0];
}

function validRecipeIngredient(item: RecipeIngredient): boolean {
    if (!item || !Number.isFinite(item.amount) || item.amount <= 0 ||
        typeof item.unit !== 'string' || !item.unit || item.unit.length > 200) return false;
    if (item.barcodeFood === undefined) return typeof item.foodId === 'string' && !!item.foodId;
    const food = item.barcodeFood;
    if (item.foodId !== undefined || food?.isBarcode !== true || food.provenance !== 'barcode' ||
        !food.barcodeAmounts || food.barcodeAmounts.basis === 'unknown' ||
        (food.emoji !== undefined && typeof food.emoji !== 'string') ||
        (food.color !== undefined && typeof food.color !== 'string') ||
        (food.barcode !== undefined && (typeof food.barcode !== 'string' || !food.barcode.trim() || food.barcode.length > 80)) ||
        !parseCustomFoods([{ ...food, id: 'recipe-barcode' }])) return false;
    try { foodAmountToBase(food, item.amount, item.unit); return true; }
    catch { return false; }
}

export function createBarcodeIngredient(food: FoodSearchResult, amount: number, unit: string): RecipeIngredient {
    if (!food.isBarcode || !food.barcodeAmounts) throw new Error('Invalid scanned product');
    const barcodeFood: RecipeBarcodeFood = {
        name: food.name.trim(), brand: food.brand?.trim(), barcode: food.barcode, emoji: food.emoji, color: food.color,
        kcalPer100: food.kcalPer100, protPer100: food.protPer100, carbPer100: food.carbPer100, fatPer100: food.fatPer100,
        defaultUnit: food.barcodeAmounts.basis === 'ml' ? 'ml' : 'g', isBarcode: true, provenance: 'barcode',
        barcodeAmounts: food.barcodeAmounts,
    };
    const ingredient = { barcodeFood, amount, unit };
    if (!validRecipeIngredient(ingredient)) throw new Error('Invalid barcode ingredient');
    return ingredient;
}

export function validateDefinition(value: unknown): CatalogFood {
    const food = value as CatalogFood;
    if (!food || !['food', 'recipe'].includes(food.kind) || !parseCustomFoods([food]) ||
        (food.description !== undefined && (typeof food.description !== 'string' || food.description.length > 2000)) ||
        (food.barcode !== undefined && (typeof food.barcode !== 'string' || food.barcode.length > 80))) throw new Error('Invalid food definition');
    if (food.kind === 'recipe') {
        const recipe = food.recipe;
        if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.length > MAX_RECIPE_INGREDIENTS ||
            !recipe.yield || !['g', 'ml', 'serving'].includes(recipe.yield.unit) || !Number.isFinite(recipe.yield.amount) || recipe.yield.amount <= 0 ||
            !recipe.ingredients.every(validRecipeIngredient)) throw new Error('Invalid recipe');
    }
    return { ...food, temporary: undefined, name: food.name.trim(), brand: food.brand?.trim(), catalogFoodId: food.id, isLiquid: food.defaultUnit === 'ml' };
}

export function validChange(value: unknown): value is LibraryChange {
    const item = value as LibraryChange;
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.foodId !== 'string' || !item.foodId ||
        !Number.isSafeInteger(item.at) || item.at < 0) return false;
    if (item.kind === 'favorite') return typeof item.favorite === 'boolean';
    if (item.kind !== 'definition') return false;
    try { return item.food === null || validateDefinition(item.food).id === item.foodId; } catch { return false; }
}

export function readLibraryState(): LibraryState {
    const raw = localStorage.getItem(FOOD_LIBRARY_KEY);
    const state: LibraryState = raw ? JSON.parse(raw) : { version: 1, changes: [], pending: [], imported: [] };
    if (state.version !== 1 || !Array.isArray(state.changes) || !state.changes.every(validChange) ||
        !Array.isArray(state.pending) || !state.pending.every(id => typeof id === 'string') ||
        !Array.isArray(state.imported) || !state.imported.every(id => typeof id === 'string')) throw new Error('Invalid food library');
    return state;
}

function write(state: LibraryState): void { localStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(state)); }
function announce(): void { window.dispatchEvent(new Event('storage')); }

// Independent definition/favorite registers resolve concurrent edits by logical time, then operation ID.
export function materialize(changes: LibraryChange[]): { foods: Map<string, CatalogFood>; favorites: Set<string>; deleted: Set<string> } {
    const registers = new Map<string, LibraryChange>();
    for (const change of changes) {
        const key = `${change.foodId}:${change.kind}`;
        const previous = registers.get(key);
        if (!previous || change.at > previous.at || (change.at === previous.at && change.id > previous.id)) registers.set(key, change);
    }
    const foods = new Map<string, CatalogFood>(), favorites = new Set<string>(), deleted = new Set<string>();
    for (const change of registers.values()) {
        if (change.kind === 'favorite') { if (change.favorite) favorites.add(change.foodId); }
        else if (change.food) foods.set(change.foodId, change.food);
        else deleted.add(change.foodId);
    }
    return { foods, favorites, deleted };
}

export function migrateLegacyLibrary(): void {
    const state = readLibraryState();
    const known = new Set(state.imported);
    const current = materialize(state.changes);
    const customs = readCustomFoods();
    const favorites = readFavourites();
    const incoming: { food: FoodSearchResult; id: string; favorite: boolean }[] = customs.map(food => ({ food, id: food.id, favorite: false }));
    if (Array.isArray(favorites)) for (const food of favorites) {
        if (!food || typeof food.name !== 'string') continue;
        const matches = customs.filter(item => foodIdentity(item) === foodIdentity(food));
        incoming.push({ food, id: (matches.length === 1 ? matches[0].id : undefined) || `legacy:${legacyId(foodIdentity(food))}`, favorite: true });
    }
    for (const item of incoming) {
        const token = `${item.favorite ? 'favorite' : 'food'}:${item.id}`;
        if (known.has(token)) continue;
        const definition = { ...item.food, id: item.id,
            defaultUnit: item.food.defaultUnit === 'pcs' ? 'g' : item.food.defaultUnit || (item.food.isLiquid ? 'ml' : 'g'),
            ...(item.food.defaultUnit === 'pcs' && !item.food.portion ? { portion: { unit: 'pcs', amount: 1 } } : {}), kind: 'food' };
        let parsed: CatalogFood;
        try { parsed = validateDefinition(definition); } catch { continue; }
        if (!current.foods.has(item.id) && !current.deleted.has(item.id)) {
            const change: LibraryChange = { id: `import:${item.id}:${legacyId(foodIdentity(item.food))}`, foodId: item.id, at: 0, kind: 'definition', food: parsed };
            state.changes.push(change); state.pending.push(change.id); current.foods.set(item.id, parsed);
        }
        if (item.favorite) {
            const change: LibraryChange = { id: `import-favorite:${item.id}`, foodId: item.id, at: 0, kind: 'favorite', favorite: true };
            state.changes.push(change); state.pending.push(change.id);
        }
        known.add(token);
    }
    if (known.size !== state.imported.length) { state.imported = [...known]; write(state); }
}

export function libraryData() {
    migrateLegacyLibrary();
    return materialize(readLibraryState().changes);
}

function mutate(change: Omit<LibraryChange, 'id' | 'at'>, owner: string): void {
    if (activeOwner() !== owner) throw new Error('Food workspace changed');
    const state = readLibraryState();
    const at = state.changes.reduce((latest, item) => Math.max(latest, item.at + 1), Date.now());
    const operation = { ...change, id: generateId('library'), at } as LibraryChange;
    if (!validChange(operation)) throw new Error('Invalid library change');
    write({ ...state, changes: [...state.changes, operation], pending: [...state.pending, operation.id] });
    announce();
}

export function saveLibraryFood(food: CatalogFood, owner = activeOwner()): CatalogFood {
    let parsed = validateDefinition(food);
    const { foods } = libraryData();
    if (parsed.kind === 'food' && !foods.has(parsed.id)) {
        const existing = preferredFood([...foods.values()].filter(item => item.kind === 'food' && sameFood(item, parsed)));
        if (existing) parsed = { ...parsed, id: existing.id, catalogFoodId: existing.id };
    }
    foods.set(parsed.id, parsed);
    resolveFood(parsed.id, foods); // Reject missing ingredients, cycles and invalid nutrition before writing.
    mutate({ foodId: parsed.id, kind: 'definition', food: parsed } as Omit<LibraryChange, 'id' | 'at'>, owner);
    return parsed;
}

export function ensureLibraryFood(food: FoodSearchResult, owner = activeOwner(), updateDefinition = false): FoodSearchResult {
    if (food.aiRecipeCandidate) throw new Error('Review recipe ingredients before saving.');
    const { foods, deleted } = libraryData();
    if (food.catalogFoodId && deleted.has(food.catalogFoodId)) throw new Error('This food was deleted. Remove it from the selection.');
    const matches = [...foods.values()].filter(item => item.kind === 'food' && sameFood(item, food));
    const existing = food.catalogFoodId ? foods.get(food.catalogFoodId) : preferredFood(matches);
    let id = existing?.id || food.catalogFoodId || generateId('food');
    if (!existing || (updateDefinition && existing.kind === 'food')) {
        id = saveLibraryFood({ ...food, id, kind: 'food', defaultUnit: food.defaultUnit === 'ml' || food.isLiquid ? 'ml' : 'g',
            ...(food.defaultUnit === 'pcs' && !food.portion ? { portion: { unit: 'pcs', amount: 1 } } : {}) }, owner).id;
    } else if (food.selectedAmount && foodAmountUnits(food).includes(food.selectedAmount.unit) &&
        Number.isFinite(food.selectedAmount.amount) && food.selectedAmount.amount > 0 &&
        JSON.stringify(existing.selectedAmount) !== JSON.stringify(food.selectedAmount)) {
        saveLibraryFood({ ...existing, selectedAmount: food.selectedAmount }, owner);
    }
    return { ...food, temporary: undefined, catalogFoodId: id };
}

export function setFoodFavorite(food: FoodSearchResult, favorite: boolean, owner = activeOwner()): FoodSearchResult {
    const saved = ensureLibraryFood(food, owner);
    if (!favorite) {
        const { foods, favorites } = libraryData();
        for (const alias of foods.values()) if (alias.id !== saved.catalogFoodId && sameFood(alias, saved) && favorites.has(alias.id)) {
            mutate({ foodId: alias.id, kind: 'favorite', favorite: false } as Omit<LibraryChange, 'id' | 'at'>, owner);
        }
    }
    mutate({ foodId: saved.catalogFoodId!, kind: 'favorite', favorite } as Omit<LibraryChange, 'id' | 'at'>, owner);
    return saved;
}

export function isFoodFavorite(food: FoodSearchResult): boolean {
    try {
        const { foods, favorites } = libraryData();
        return [...foods.values()].some(item => (item.id === food.catalogFoodId || sameFood(item, food)) && favorites.has(item.id));
    } catch { return false; }
}

export function deleteLibraryFood(id: string, owner = activeOwner()): void {
    const { foods } = libraryData();
    const selected = foods.get(id);
    const ids = new Set(selected?.kind === 'food' ? [...foods.values()].filter(food => food.kind === 'food' && sameFood(food, selected)).map(food => food.id) : [id]);
    if ([...foods.values()].some(food => food.recipe?.ingredients.some(item => item.foodId && ids.has(item.foodId)))) throw new Error('Used by a recipe. Edit or delete that recipe first.');
    for (const foodId of ids) mutate({ foodId, kind: 'definition', food: null } as Omit<LibraryChange, 'id' | 'at'>, owner);
}

export function resolveFood(id: string, foods: Map<string, CatalogFood>, path = new Set<string>(), budget = { remaining: 1000 }): FoodSearchResult {
    if (--budget.remaining < 0) throw new Error('This recipe has too many nested ingredients. Simplify it before logging.');
    const definition = foods.get(id);
    if (!definition) throw new Error('An ingredient is missing. Repair the recipe before logging.');
    if (path.has(id) || path.size > 30) throw new Error('Recipes cannot contain circular references.');
    const validated = validateDefinition(definition);
    if (definition.kind !== 'recipe') return { ...validated, catalogFoodId: id };
    const recipe = definition.recipe!;
    const nextPath = new Set([...path, id]);
    const ingredients = recipe.ingredients.map(item => {
        if (!item.barcodeFood) return { amount: item.amount, unit: item.unit, food: resolveFood(item.foodId, foods, nextPath, budget) };
        if (--budget.remaining < 0) throw new Error('This recipe has too many nested ingredients. Simplify it before logging.');
        return { amount: item.amount, unit: item.unit, food: item.barcodeFood };
    });
    const baseAmounts = ingredients.map(item => foodAmountToBase(item.food, item.amount, item.unit).amount);
    const totals = Object.fromEntries(NUTRIENTS.map(key => [key, ingredients.reduce((total, item, index) =>
        total + item.food[key] * baseAmounts[index] / 100, 0)]));
    const factor = recipe.yield.unit === 'serving' ? 1 / recipe.yield.amount : 100 / recipe.yield.amount;
    const result = { ...definition, ...Object.fromEntries(NUTRIENTS.map(key => [key, totals[key] * factor])),
        catalogFoodId: id, defaultUnit: recipe.yield.unit === 'ml' ? 'ml' : 'g', isLiquid: recipe.yield.unit === 'ml',
        portion: recipe.yield.unit === 'serving' ? { unit: 'serving' as const, amount: 100 } : undefined,
        recipeSnapshot: { recipe, ingredients } } as FoodSearchResult;
    if (NUTRIENTS.some(key => !Number.isFinite(result[key]) || result[key] < 0)) throw new Error('Recipe nutrition is invalid.');
    return result;
}

export function historyFood(entry: FoodEntry): FoodSearchResult | null {
    if (entry.foodSnapshot) {
        const food = { ...entry.foodSnapshot, barcode: entry.foodSnapshot.barcode || entry.barcode,
            isBarcode: entry.foodSnapshot.isBarcode || entry.isBarcode,
            catalogFoodId: entry.foodSnapshot.temporary ? undefined : entry.catalogFoodId };
        if (!food.selectedAmount && entry.amount && foodAmountUnits(food).includes(entry.unit || 'g')) food.selectedAmount = { amount: entry.amount, unit: entry.unit || 'g' };
        return food;
    }
    const amount = entry.amount ?? entry.weight;
    if (!amount || !Number.isFinite(amount) || amount <= 0 || !['g', 'ml'].includes(entry.unit || 'g') ||
        [entry.kcal, entry.prot, entry.carb, entry.fat].some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
    return { name: entry.food, brand: entry.brand, barcode: entry.barcode, defaultUnit: entry.unit || 'g',
        isLiquid: entry.unit === 'ml', isBarcode: entry.isBarcode, selectedAmount: { amount, unit: entry.unit || 'g' }, kcalPer100: entry.kcal * 100 / amount, protPer100: entry.prot * 100 / amount,
        carbPer100: entry.carb * 100 / amount, fatPer100: entry.fat * 100 / amount, provenance: 'history', catalogFoodId: entry.catalogFoodId };
}

export function searchLibrary(entries: FoodEntry[], query: string, onlyFavorites = false, now = Date.now()): LibraryItem[] {
    const { foods, favorites, deleted } = libraryData();
    const results = new Map<string, LibraryItem>();
    for (const [id, definition] of foods) {
        let food: FoodSearchResult = definition, error: string | undefined;
        try { food = resolveFood(id, foods); } catch (caught) { error = caught instanceof Error ? caught.message : 'Repair this food before logging.'; }
        results.set(id, { id, food, favorite: favorites.has(id), saved: true, error });
    }
    for (const entry of [...entries].sort((a, b) => b.ts - a.ts)) {
        const food = historyFood(entry);
        if (!food) continue;
        let id = food.temporary ? `temporary:${foodIdentity(food)}` : food.catalogFoodId;
        if (!id) {
            const matches = [...foods.values()].filter(item => item.kind === 'food' && sameFood(item, food));
            id = preferredFood(matches)?.id || `history:${foodIdentity(food)}`;
        }
        if (deleted.has(id)) continue;
        const item = results.get(id);
        if (item) {
            if (!item.latest || entry.ts > item.latest.ts) {
                item.latest = entry;
                if (!item.food.selectedAmount && food.selectedAmount) item.food = { ...item.food, selectedAmount: food.selectedAmount };
            }
        }
        else if (entry.ts >= now - 14 * 86400000) results.set(id, { id, food, favorite: false, latest: entry, saved: false });
    }
    const unique = new Map<string, LibraryItem>();
    for (const item of results.values()) {
        const recipe = item.food.recipeSnapshot || ('kind' in item.food && item.food.kind === 'recipe');
        const key = recipe || item.food.temporary ? item.id : barcodeIdentity(item.food) || `food:${foodIdentity(item.food)}`;
        const previous = unique.get(key);
        if (!previous) { unique.set(key, item); continue; }
        const preferred = preferredFood([previous.food, item.food]) === item.food ? item : previous;
        const latest = !previous.latest || (item.latest && item.latest.ts > previous.latest.ts) ? item.latest : previous.latest;
        unique.set(key, { ...preferred, favorite: previous.favorite || item.favorite, latest });
    }
    const terms = query.trim().toLocaleLowerCase().split(/\s+/);
    return [...unique.values()].filter(item => (!onlyFavorites || item.favorite) && terms.every(term =>
        `${item.food.name} ${item.food.brand || ''}`.toLocaleLowerCase().includes(term)))
        .sort((a, b) => (b.latest?.ts || 0) - (a.latest?.ts || 0) || a.food.name.localeCompare(b.food.name));
}

export function mergeLibraryChanges(incoming: LibraryChange[], acknowledged: string[], owner: string): void {
    if (activeOwner() !== owner || !incoming.every(validChange)) throw new Error('Invalid library sync');
    const state = readLibraryState();
    const operations = new Map(state.changes.map(change => [change.id, change]));
    for (const change of incoming) operations.set(change.id, change);
    const confirmed = new Set(acknowledged);
    write({ ...state, changes: [...operations.values()], pending: state.pending.filter(id => !confirmed.has(id)) });
    announce();
}
