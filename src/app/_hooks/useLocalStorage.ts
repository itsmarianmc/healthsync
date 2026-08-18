'use client';

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item) as T;
        } catch (e) {
            console.error(`Error parsing local storage key: ${key}`, e);
            return defaultValue;
        }
    });

    const setStoredValue = useCallback((val: T) => {
        setValue(val);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(key, JSON.stringify(val));
                window.dispatchEvent(new StorageEvent('storage', { key }));
            } catch (e) {
                console.error(`Error saving to local storage for key: ${key}`, e);
            }
        }
    }, [key]);

    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === key) {
                try {
                    const item = localStorage.getItem(key);
                    if (item !== null) setValue(JSON.parse(item) as T);
                } catch (e) {
                    console.error(`Error parsing storage event for key: ${key}`, e);
                }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [key]);

    return [value, setStoredValue];
}
