'use client';

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item) as T;
        } catch {
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((val: T) => {
        setValue(val);
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(val));
            window.dispatchEvent(new StorageEvent('storage', { key }));
        }
    }, [key]);

    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === key) {
                try {
                    const item = localStorage.getItem(key);
                    if (item !== null) setValue(JSON.parse(item) as T);
                } catch {
                    console.error('Failed to parse localStorage item', e);
                }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [key]);

    return [value, setStoredValue];
}
