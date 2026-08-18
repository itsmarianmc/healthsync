let idCounter = 0;

export function generateId(prefix = 'id'): string {
    const timestamp = Date.now().toString(36);
    const counter = (idCounter++).toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${timestamp}${counter}${random}`;
}

export function generateDetectionId(): string {
    return generateId('det');
}

export function generateDraftId(): string {
    return generateId('draft');
}

export function generateEntryId(): string {
    return generateId('entry');
}